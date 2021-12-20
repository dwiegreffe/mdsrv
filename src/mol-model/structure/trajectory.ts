/**
 * Copyright (c) 2020-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { XtcFile } from '../../mol-io/reader/xtc/parser';
import { coordinatesFromXtc } from '../../mol-model-formats/structure/xtc';
import { PluginContext } from '../../mol-plugin/context';
import { RuntimeContext, Task } from '../../mol-task';
import { urlCombine } from '../../mol-util/url';
import { Coordinates, Model } from '../structure';

export type TrajectoryFrameType =
  | { type: 'default' }
  /** Returns the closest available frame to the requested index  */
  | { type: 'snap' }
  /** Interpolates between two available adjacent frames */
  | { type: 'interpolate', kind?: 'linear' }

/**
 * A generic interface for representing (partial) trajectories
 */
export interface Trajectory {
    readonly duration: number,
    readonly frameCount: number,

    /** Statically available representative model. Required for example by certain UI actions. */
    readonly representative: Model,

    /** Allows to asynchronously query data from a server or interpolate frames on the fly */
    getFrameAtIndex(i: number, type?: TrajectoryFrameType): Task<Model> | Model
}

export class ArrayTrajectory implements Trajectory {
    readonly duration: number;
    readonly frameCount: number;
    readonly representative: Model;

    getFrameAtIndex(i: number) {
        return this.frames[i];
    }

    constructor(private frames: Model[]) {
        this.frameCount = frames.length;
        this.representative = frames[0];
        this.duration = frames.length;
    }
}

export class XtcTrajectoryStream implements Trajectory {
    readonly duration: number;
    readonly frameCount: number;
    readonly representative: Model;

    private async getCoordinates(ctx: RuntimeContext, i: number): Promise<Coordinates> {
        const offset = this.frameStarts[i];
        const url = urlCombine(this.url, `frame/offset/${offset}`);
        const file: XtcFile = await this.plugin.runTask(this.plugin.fetch({ url, type: 'json' }));
        return coordinatesFromXtc(file).runInContext(ctx);
    }

    getFrameAtIndex(i: number) {
        return Task.create('Parse XTC Frame', async ctx => {
            const coordinates = await this.getCoordinates(ctx, i); // only one frame
            const traj = Model.trajectoryFromModelAndCoordinates(this.model, coordinates);
            return traj.representative; // traj has only one frame which is the representative
        });
    }

    constructor(private plugin: PluginContext, private url: string, private frameStarts: number[], private model: Model) {
        this.frameCount = frameStarts.length;
        this.representative = model;
        this.duration = frameStarts.length;
    }
}