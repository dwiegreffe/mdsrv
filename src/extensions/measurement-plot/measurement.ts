/**
 * Copyright (c) 2017-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 *
 * parts adapted from /src/mol-model/structure/structure/element/loci
 */

import { OrderedSet } from '../../mol-data/int';
import { Vec3 } from '../../mol-math/linear-algebra';
import { radToDeg } from '../../mol-math/misc';
import { Loci } from '../../mol-model/loci';
import { Structure, StructureElement, Trajectory } from '../../mol-model/structure';
import { PluginStateObject } from '../../mol-plugin-state/objects';
import { StateTransforms } from '../../mol-plugin-state/transforms';
import { StateAction, StateSelection } from '../../mol-state';
import { Task } from '../../mol-task';
import { ParamDefinition as PD } from '../../mol-util/param-definition';

/** Line plot value: value for a specific frame. */
export type PlotValue = {
    frame: number,
    value: number | undefined
}

/**
 * Return Task to calculate distances for all frames of a trajectory.
 * @param locis Loci list of two
 * @param trajectory Trajectory
 * @returns  Task
 */
export function calculateDistances(locis: StructureElement.Loci[], trajectory: Trajectory, skip: number, values: PlotValue[], progress: number) {
    return Task.create('Calculate Distance Line Plot Part', async ctx => {
        await ctx.update({ message: 'Initializing...', isIndeterminate: true });
        const distances: PlotValue[] = values;
        await ctx.update({ message: 'Calculating Distance Line Plot...', isIndeterminate: false, current: progress, max: trajectory.frameCount - 1 });
        for (let i = 0; i < trajectory.frameCount; i++) {
            if (distances[i].value === undefined && (i % skip === 0)) {
                const model = await Task.resolveInContext(trajectory.getFrameAtIndex(i));
                const structure = Structure.ofModel(model);

                const [lA, lB] = locis.map(l => Loci.getCenter(StructureElement.Loci.remap(l, structure))!);
                const distance = Vec3.distance(lA, lB);
                distances[i] = { frame: i, value: distance };
                await ctx.update({ current: progress++ });
            }
        }
        return { values: distances, progress };
    });
}

/**
 * Return Task to calculate angles for all frames of a trajectory.
 * @param locis Loci list of three
 * @param trajectory Trajectory
 * @returns  Task
 */
export function calculateAngles(locis: StructureElement.Loci[], trajectory: Trajectory, skip: number, values: PlotValue[], progress: number) {
    return Task.create('Calculation Angle Line Plot Part', async ctx => {
        await ctx.update({ message: 'Initializing...', isIndeterminate: true });
        const angles: PlotValue[] = values;
        await ctx.update({ message: 'Calculating Angle Line Plot...', isIndeterminate: false, current: 0, max: trajectory.frameCount - 1 });
        for (let i = 0; i < trajectory.frameCount; i++) {
            if (angles[i].value === undefined && (i % skip === 0)) {
                const model = await Task.resolveInContext(trajectory.getFrameAtIndex(i));
                const structure = Structure.ofModel(model);

                const [lA, lB, lC] = locis.map(l => Loci.getCenter(StructureElement.Loci.remap(l, structure))!);
                const vAB = Vec3.sub(Vec3(), lA, lB);
                const vCB = Vec3.sub(Vec3(), lC, lB);
                const angle = radToDeg(Vec3.angle(vAB, vCB));
                angles[i] = { frame: i, value: angle };
                await ctx.update({ current: progress++ });
            }
        }
        return { values: angles, progress };
    });
}

/**
 * Return Task to calculate dihedrals for all frames of a trajectory.
 * @param locis Loci list of four
 * @param trajectory Trajectory
 * @returns  Task
 */
export function calculateDihedrals(locis: StructureElement.Loci[], trajectory: Trajectory, skip: number, values: PlotValue[], progress: number) {
    return Task.create('Calculation Dihedral Line Plot Part', async ctx => {
        await ctx.update({ message: 'Initializing...', isIndeterminate: true });
        const dihedrals: PlotValue[] = values;
        await ctx.update({ message: 'Calculating Dihedral Line Plot...', isIndeterminate: false, current: 0, max: trajectory.frameCount - 1 });
        for (let i = 0; i < trajectory.frameCount; i++) {
            if (dihedrals[i].value === undefined && (i % skip === 0)) {
                const model = await Task.resolveInContext(trajectory.getFrameAtIndex(i));
                const structure = Structure.ofModel(model);

                const [lA, lB, lC, lD] = locis.map(l => Loci.getCenter(StructureElement.Loci.remap(l, structure))!);
                const dihedral = radToDeg(Vec3.dihedralAngle(lA, lB, lC, lD));
                dihedrals[i] = { frame: i, value: dihedral };
                await ctx.update({ current: progress++ });
            }
        }
        return { values: dihedrals, progress };
    });
}

// parts adapted from /src/mol-model/structure/structure/element/loci
/**
 * Returns Task to calculate RMSD of a trajectory to comparison frame.
 * @param locis Loci list
 * @param trajectory Trajectory
 * @param frame Comparison frame number
 * @returns Task
 */
export function calculateRmsd(trajectory: Trajectory, frame: number) {
    return Task.create('Calculation RMSD Line Plot', async ctx => {
        await ctx.update({ message: 'Initializing...', isIndeterminate: true });
        const rmsd: PlotValue[] = [];
        const modelA = await Task.resolveInContext(trajectory.getFrameAtIndex(frame));
        const structureA = Structure.ofModel(modelA);
        const allA = StructureElement.Loci.all(structureA);

        await ctx.update({ message: 'Calculating RMSD Line Plot...', isIndeterminate: false, current: 0, max: trajectory.frameCount - 1 });
        for (let i = 0; i < trajectory.frameCount; i++) {
            const modelB = await Task.resolveInContext(trajectory.getFrameAtIndex(i));
            const atomDistances: number[] = [];

            for (const e of allA.elements) {
                const { indices } = e;
                const { elements } = e.unit;
                for (let j = 0, _j = OrderedSet.size(indices); j < _j; j++) {
                    const eI = elements[OrderedSet.getAt(indices, j)];

                    const xA = modelA.atomicConformation.x[eI];
                    const yA = modelA.atomicConformation.y[eI];
                    const zA = modelA.atomicConformation.z[eI];
                    const posA = Vec3.fromArray(Vec3(), [xA, yA, zA], 0);

                    const xB = modelB.atomicConformation.x[eI];
                    const yB = modelB.atomicConformation.y[eI];
                    const zB = modelB.atomicConformation.z[eI];
                    const posB = Vec3.fromArray(Vec3(), [xB, yB, zB], 0);

                    atomDistances.push(Vec3.distance(posA, posB));
                }
            }
            const tmpRmsd = Math.sqrt(atomDistances.map(d => Math.pow(d, 2)).reduce((a, b) => a + b, 0) / atomDistances.length);
            rmsd.push({ frame: i, value: tmpRmsd });
            await ctx.update({ current: i + 1 });
        }
        return rmsd;
    });
}

// adapted from /src/mol-plugin-state/actions/structure.ts
/** Sets the frame of a trajectory with trajectory ref to given frame. */
export const SkipToFrame = StateAction.build({
    display: { name: 'Skip to Trajectory Frame', description: 'Skips to specific frame of a given trajectory.' },
    params: {
        trajRef: PD.Text(''),
        skip: PD.Numeric(0)
    }
})(({ params, state }) => {
    const models = state.selectQ(q => q.ofTransformer(StateTransforms.Model.ModelFromTrajectory));

    const update = state.build();

    for (const m of models) {
        if (!m.sourceRef) continue;
        const parent = StateSelection.findAncestorOfType(state.tree, state.cells, m.transform.ref, PluginStateObject.Molecule.Trajectory);
        if (!parent || !parent.obj) continue;
        const traj = parent.obj;
        if (parent.transform.ref === params.trajRef) {
            update.to(m).update(old => {
                let modelIndex = params.skip;
                if (modelIndex < 0 || traj.data.frameCount < modelIndex) modelIndex = old.modelIndex;
                return { modelIndex };
            });
        }
    }

    return state.updateTree(update);
});

/**
 * @param values PlotValue[]
 * @param sorting sorting method
 * @returns sorted PlotValue[]
 */
export function sortPlot(values: PlotValue[], sorting: string): PlotValue[] {
    switch (sorting) {
        case 'frames': return values.sort((a, b) => (a.frame > b.frame) ? 1 : -1);
        case 'asc': return values.sort((a, b) => sortAsc(a, b));
        case 'desc': return values.sort((a, b) => sortDesc(a, b));
        default: return values;
    }
}

function sortAsc(a: PlotValue, b: PlotValue) {
    if (!a.value) return 1;
    else if (!b.value) return -1;
    else if (a.value > b.value) return 1;
    else return -1;
}

function sortDesc(a: PlotValue, b: PlotValue) {
    if (!b.value) return -1;
    else if (!a.value) return 1;
    else if (a.value < b.value) return 1;
    else return -1;
}

export function dictPlot(values: PlotValue[]) {
    const dict: number[] = new Array(values.length);
    values.forEach((v, i) => {
        dict[v.frame] = i;
    });
    return dict;
}

/**
 * @param values PlotValue[]
 * @param min filter min
 * @param max filter max
 * @returns filtered PlotValue[]
 */
export function filterPlot(values: PlotValue[], min: number, max: number): PlotValue[] {
    const filtered: PlotValue[] = [];
    for (let i = 0; i < values.length; i++) {
        if (values[i].value === undefined) {
            filtered.push(values[i]);
        } else if (min <= values[i].value! && values[i].value! <= max) {
            filtered.push(values[i]);
        }
    }
    return filtered;
}

/**
 * Returns unit label for measurement type.
 * @param measurement type
 * @returns unit label string
 */
export function unitLabel(measurement: string) {
    switch (measurement) {
        case 'distance': return '\u212B';
        case 'angle': return '\u00B0';
        case 'dihedral': return '\u00B0';
        default: return '';
    }
}

/**
 * Calculates canvas text width of text.
 * @param text Text
 * @returns width
 */
export function textWidth(text: string) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    context.font = '12px';
    const metrics = context.measureText(text);
    return metrics.width;
}