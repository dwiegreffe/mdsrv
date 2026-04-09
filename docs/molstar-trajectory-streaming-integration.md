# Mol* XTC Trajectory Streaming Integration Guide

This guide explains how to add remote XTC trajectory streaming to a Mol* codebase from scratch.

It assumes:

- you already have a Mol* application
- you can load a structure, model, or topology into the state tree
- you want to attach a trajectory that stays on the server and stream frames on demand

## Goal

Given an already loaded `Model` or `Topology`, create a Mol* trajectory that:

- fetches frame start offsets from a server
- fetches only the requested frame range
- converts the returned XTC frame payload into coordinates
- exposes the result as a normal Mol* trajectory/model flow

## What you need to add

You need four pieces:

1. a backend API for XTC streaming
2. a runtime trajectory class that fetches frames lazily
3. a Mol* state transform that creates that trajectory class
4. optional UI to list/select trajectories and apply the transform

## 1. Backend API contract

For one trajectory resource base URL, Mol* needs these two endpoints:

### Frame starts

```http
GET <trajectory-base-url>/starts
```

Response body:

```text
0,1144,2288,3432
```

This is a comma-separated list of byte offsets, one per frame.

### Frame by offset range

```http
GET <trajectory-base-url>/frame/offset/:start/:end
```

Response body:

- JSON matching the XTC payload shape consumed by Mol*

Example URL shape:

- `/api/v1/trajectory/traj-001/starts`
- `/api/v1/trajectory/traj-001/frame/offset/0/1144`

## 2. Add a lazy XTC trajectory runtime class

Create a trajectory implementation similar to this:

```ts
import { XtcFile } from '../../mol-io/reader/xtc/parser';
import { coordinatesFromXtc } from '../../mol-model-formats/structure/xtc';
import { PluginContext } from '../../mol-plugin/context';
import { RuntimeContext, Task } from '../../mol-task';
import { urlCombine } from '../../mol-util/url';
import { Coordinates, Model } from '../structure';

export interface Trajectory {
    readonly duration: number,
    readonly frameCount: number,
    readonly representative: Model,
    getFrameAtIndex(i: number): Task<Model> | Model
}

export class XtcTrajectoryStream implements Trajectory {
    readonly duration: number;
    readonly frameCount: number;
    readonly representative: Model;

    private async getCoordinates(ctx: RuntimeContext, i: number): Promise<Coordinates> {
        const start = this.frameStarts[i];
        const end = (i === this.frameCount - 1) ? Infinity : this.frameStarts[i + 1];
        const url = urlCombine(this.url, `frame/offset/${start}/${end}`);
        const file: XtcFile = await this.plugin.runTask(this.plugin.fetch({ url, type: 'json' }));
        return coordinatesFromXtc(file).runInContext(ctx);
    }

    getFrameAtIndex(i: number) {
        return Task.create('Parse XTC Frame', async ctx => {
            const coordinates = await this.getCoordinates(ctx, i);
            const traj = Model.trajectoryFromModelAndCoordinates(this.model, coordinates);
            return traj.representative;
        });
    }

    constructor(
        private plugin: PluginContext,
        private url: string,
        private frameStarts: number[],
        private model: Model
    ) {
        this.frameCount = frameStarts.length;
        this.representative = model;
        this.duration = frameStarts.length;
    }
}
```

What this does:

- stores the server base URL for one trajectory
- stores the frame start offsets
- fetches only one frame when `getFrameAtIndex()` is called
- converts XTC frame JSON into Mol* coordinates

## 3. Add a Mol* state transform

Add a transform that creates the streaming trajectory from an existing `Model` or `Topology`.

Core idea:

```ts
async function getXTCTrajectoryStream(ctx: RuntimeContext, plugin: PluginContext, obj: StateObject, url: string) {
    const data = await plugin.runTask(plugin.fetch({ url: urlCombine(url, 'starts'), type: 'string' }));
    const startOffsets = data.split(',').map(Number);

    if (obj.type === SO.Molecule.Topology.type) {
        const topology = obj.data as Topology;
        const models = await createModels(topology.basic, topology.sourceData, ctx);
        return new XtcTrajectoryStream(plugin, url, startOffsets, models.representative);
    }

    if (obj.type === SO.Molecule.Model.type) {
        return new XtcTrajectoryStream(plugin, url, startOffsets, obj.data as Model);
    }

    throw new Error('no model/topology found');
}
```

Then wrap it in a standard Mol* `PluginStateTransform.BuiltIn(...)` transform.

Recommended parameters:

- `modelRef`
- `trajectoryUrl`

The transform should:

1. resolve the referenced `Model` or `Topology`
2. fetch `<trajectoryUrl>/starts`
3. create `XtcTrajectoryStream`
4. return `SO.Molecule.Trajectory`

## 4. Apply the transform in the state tree

Once you have a model or topology ref, apply the transform like this:

```ts
const model = state.build().toRoot()
    .apply(TrajectoryXTCFromModelAndServer, {
        modelRef: existingModelOrTopologyRef,
        trajectoryUrl: `${serverUrl}/api/v1/trajectory/${trajectoryId}`
    }, { dependsOn: [existingModelOrTopologyRef] })
    .apply(StateTransforms.Model.ModelFromTrajectory, { modelIndex: 0 });

await state.updateTree(model).runInContext(taskCtx);

const structure = await plugin.builders.structure.createStructure(model.selector);
await plugin.builders.structure.representation.applyPreset(structure, 'auto');
```

Important:

- `trajectoryUrl` must be the trajectory base resource URL
- the runtime class appends `/starts` and `/frame/offset/...` itself

## 5. Optional UI layer

If you want a UI panel, you only need three frontend actions:

1. fetch the available trajectory list
2. let the user select one trajectory and one loaded model/topology
3. apply the transform

### Suggested list endpoint

```http
GET /api/v1/trajectory
```

Suggested response shape:

```json
[
  {
    "id": "traj-001",
    "name": "traj-001",
    "description": "Example trajectory",
    "source": "example.org",
    "timestamp": 1775055002387
  }
]
```

The UI can turn one entry into a base URL like:

```ts
const trajectoryUrl = `${serverUrl}/api/v1/trajectory/${entry.id}`;
```

## 6. Minimal implementation checklist

Backend:

- [ ] expose `GET /starts`
- [ ] expose `GET /frame/offset/:start/:end`
- [ ] optionally expose `GET /api/v1/trajectory`

Mol* runtime:

- [ ] add `XtcTrajectoryStream`
- [ ] fetch one frame at a time
- [ ] convert frame payload using `coordinatesFromXtc`

Mol* state:

- [ ] add `TrajectoryXTCFromModelAndServer`
- [ ] support both `Model` and `Topology`
- [ ] return `SO.Molecule.Trajectory`

UI:

- [ ] list trajectories
- [ ] select model/topology
- [ ] apply transform

## 7. Common mistakes

### Using the wrong `trajectoryUrl`

Wrong:

- pointing to the list endpoint

Correct:

- point to one trajectory base URL, for example `/api/v1/trajectory/traj-001`

### Returning the wrong payload from `/frame/offset/...`

The response must match the XTC JSON shape Mol* expects.

### Treating the trajectory as a full download

The point of this integration is lazy frame loading. Do not download the whole XTC into the browser first.

### Forgetting topology support

If the current object is a `Topology`, create a representative `Model` first and then attach the stream to that model.

## 8. Scope of this guide

Covered:

- XTC-only
- server-side frame lookup
- on-demand frame streaming
- attaching streamed coordinates to an existing model/topology

Not covered:

- DCD/TRR streaming
- upload UI design
- server implementation details for XTC parsing
- topology registry integration
