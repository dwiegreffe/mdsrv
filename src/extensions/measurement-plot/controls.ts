/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { StructureElement, Trajectory } from '../../mol-model/structure';
import { PluginComponent } from '../../mol-plugin-state/component';
import { StateTransforms } from '../../mol-plugin-state/transforms';
import { PluginContext } from '../../mol-plugin/context';
import { DistanceData } from '../../mol-repr/shape/loci/distance';
import { StateSelection } from '../../mol-state';
import { ParamDefinition as PD } from '../../mol-util/param-definition';
import { AngleData } from '../../mol-repr/shape/loci/angle';
import { DihedralData } from '../../mol-repr/shape/loci/dihedral';
import { lociLabel } from '../../mol-theme/label';
import { filterPlot, calculateAngles, calculateDihedrals, calculateDistances, calculateRmsd, PlotValue, sortPlot } from './measurement';
import { arrayMax, arrayMin } from '../../mol-util/array';
import { Task } from '../../mol-task';
import { merge } from 'rxjs';
import { Color } from '../../mol-util/color';

/** Information for a single line plot */
export interface PlotInfo {
    trajectory: Trajectory,
    trajectoryRef: string,
    locis: StructureElement.Loci[],
    /** Line plot values */
    values: PlotValue[],
    min: number,
    max: number,
    /** Id of object in state tree */
    id: string,
}

export const MeasurementParam = {
    /** Dropdown choices for measurement type */
    measurement: PD.Select('distance', [
        ['distance', 'Distance'],
        ['angle', 'Angle'],
        ['dihedral', 'Dihedral']
    ])
};

export const PlotSortingParam = {
    /** Dropdown choices for sorting */
    sorting: PD.Select('frames', [
        ['frames', 'Frames'],
        ['asc', 'Ascending'],
        ['desc', 'Descending']
    ]),
};

export const RMSDParam = {
    /** Rmsd toggle */
    rmsd: PD.Boolean(false),
};

export const PlotParams = {
    // sorting: PD.Select('frames', [
    //     ['frames', 'Frames'],
    //     ['asc', 'Ascending'],
    //     ['desc', 'Descending']
    // ]),
    // rmsd: PD.Boolean(false, {description: 'Calculation of the whole model over the trajectory.'}),
    labeling: PD.Boolean(false, { label: 'Custom Axis Labeling', description: 'Enables custom labeling for the time axis (x-axis).' }),
    ticks: PD.Numeric(10, { min: 10 }, { label: 'Tick Spacing', description: 'Number of frames between two ticks of the x-axis. (Minimum: 10).' }),
    duration: PD.Numeric(0, { min: 0 }, { label: 'Frame Duration', description: 'Time span of a single frame.' }),
    unit: PD.Select('femto', [
        ['micro', 'microsecond (\u03bcs)'],
        ['nano', 'nanosecond (ns)'],
        ['pico', 'picosecond (ps)'],
        ['femto', 'femtosecond (fs)'],
        ['atto', 'attosecond (as)']
    ]),
    fixed: PD.Numeric(0, { min: 0 }, { label: 'Decimal Places', description: 'Number of decimal places.' }),
    lineColor: PD.Color(Color(0xccd4e0), { label: 'Line Color' }),
    hoverColor: PD.Color(Color(0xe67e22), { label: 'Hover Color' }),
    gridColor: PD.Color(Color(0xC0C0C0), { label: 'Grid Color' }),
    gridOpacity: PD.Numeric(1, { min: 0, max: 1, step: 0.01 }, { label: 'Grid Opacity' }),
    gridDash: PD.Numeric(4, {}, { label: 'Grid Dash' })
};

export class MeasurementLinePlotControls extends PluginComponent {

    readonly behaviors = {
        /** Lists of line plots */
        distances: this.ev.behavior<PlotInfo[]>([]),
        angles: this.ev.behavior<PlotInfo[]>([]),
        dihedrals: this.ev.behavior<PlotInfo[]>([]),

        /** Measurement type: distance, angle, dihedral */
        type: this.ev.behavior<PD.Values<typeof MeasurementParam>>(PD.getDefaultValues(MeasurementParam)),
        /**
         * type: string - Measurement type
         * param: { measurement: PD.Select } - Select for all available measurements of type
         * value: { measurement: string } - Current selected measurement for line plot display
         */
        current: this.ev.behavior<{ type: string, param: PD.Params, value: any } | undefined>(void 0),
        /** Sorting of the line plot */
        sorting: this.ev.behavior<PD.Values<typeof PlotSortingParam>>(PD.getDefaultValues(PlotSortingParam)),
        /**
         * param: { filter: PD.Interval } - Interval with min and max value of plot
         * value: { filter: Array<number> } - Interval for filtered values
         */
        filter: this.ev.behavior<{ param: PD.Params, value: any } | undefined>(void 0),
        /** toggle for rmsd display */
        rmsd: this.ev.behavior<PD.Values<typeof RMSDParam>>(PD.getDefaultValues(RMSDParam)),
        /**
         * param: { frame: PD.Numeric } - Numeric slider selection for comparison frame
         * value: { frame: number } - Selected comparison frame
         */
        frame: this.ev.behavior<{ param: PD.Params, value: any } | undefined>(void 0),
        plot: this.ev.behavior<PD.Values<typeof PlotParams>>(PD.getDefaultValues(PlotParams)),
    };

    /**
     * Measurement type change and adjustment of all dependent values: current, filter, frame.
     * @param type Measurement type
     */
    setType(type: string) {
        const currentId = this.getCurrentId();
        const distances = this.behaviors.distances.value;
        const angles = this.behaviors.angles.value;
        const dihedrals = this.behaviors.dihedrals.value;

        if (type === 'distance' && distances.length !== 0) {
            const distancesParams = distances.map(d => {
                const [lA, lB] = d.locis.map(l => { return lociLabel(l, { hidePrefix: true, htmlStyling: false }); });
                return [d.id, `${lA} \u2014 ${lB}`] as [string, string];
            });

            const param = { measurement: PD.Select(distances[0].id, distancesParams, { label: 'Distance' }) } as PD.Params;
            if (currentId === 'empty' || !this.idIn(currentId, distances)) {
                // If current was empty before, a measurement of a different type, or was removed
                this.updateSlider(distances[0].id);
                const value = PD.getDefaultValues(param);
                this.behaviors.current.next({ type: type, param, value });
            } else {
                // If current stayed the same but a new measurement of the measurement type was added
                this.behaviors.current.next({ type: type, param, value: { measurement: currentId } });
            }

        } else if (type === 'angle' && angles.length !== 0) {
            const angleParams = angles.map(a => {
                const [lA, lB, lC] = a.locis.map(l => { return lociLabel(l, { hidePrefix: true, htmlStyling: false }); });
                return [a.id, `${lA} \u2014 ${lB} \u2014 ${lC}`] as [string, string];
            });

            const param = { measurement: PD.Select(angles[0].id, angleParams, { label: 'Angle' }) } as PD.Params;
            if (currentId === 'empty' || !this.idIn(currentId, angles)) {
                this.updateSlider(angles[0].id);
                const value = PD.getDefaultValues(param);
                this.behaviors.current.next({ type: type, param, value });
            } else {
                this.behaviors.current.next({ type: type, param, value: { measurement: currentId } });
            }

        } else if (type === 'dihedral' && dihedrals.length !== 0) {
            const dihedralParams = dihedrals.map(d => {
                const [lA, lB, lC, lD] = d.locis.map(l => { return lociLabel(l, { hidePrefix: true, htmlStyling: false }); });
                return [d.id, `${lA} \u2014 ${lB} \u2014 ${lC} \u2014 ${lD}`] as [string, string];
            });

            const param = { measurement: PD.Select(dihedrals[0].id, dihedralParams, { label: 'Dihedral' }) } as PD.Params;
            if (currentId === 'empty' || !this.idIn(currentId, dihedrals)) {
                this.updateSlider(dihedrals[0].id);
                const value = PD.getDefaultValues(param);
                this.behaviors.current.next({ type: type, param, value });
            } else {
                this.behaviors.current.next({ type: type, param, value: { measurement: currentId } });
            }

        } else {
            // Default values if measurement type has no single measurements
            this.updateSlider('');
            this.defaultCurrent(type);
        }
    }

    /**
     * Adjust slider to measurement with id.
     * @param currentId measurement id
     */
    updateSlider(currentId: string) {
        const plotInfo = this.getPlotInfo(currentId);
        if (!plotInfo) {
            this.defaultFilter();
            this.defaultFrame();
        } else {
            this.updateFilter(plotInfo);
            this.updateFrame(plotInfo);
        }
    }

    /**
     * Update filter to plot info.
     * @param plotInfo PlotInfo
     */
    updateFilter(plotInfo: PlotInfo) {
        const min = plotInfo.min;
        const max = plotInfo.max;
        const param = { filter: PD.Interval([min, max], { min: min, max: max, step: 0.01 }, { label: 'Filter' }) };
        const value = PD.getDefaultValues(param);
        this.behaviors.filter.next({ param, value });
    }

    /**
     * Update frame to plot info.
     * @param plotInfo PlotInfo
     */
    updateFrame(plotInfo: PlotInfo) {
        const min = 1;
        const max = plotInfo.trajectory.frameCount;
        const param = { frame: PD.Numeric(1, { min, max, step: 1 }, { label: 'Compare Frame' }) };
        const value = PD.getDefaultValues(param);
        this.behaviors.frame.next({ param, value });
    }

    /**
     * Updates current.
     * @param value Next current value
     */
    setCurrent(value: any) {
        this.updateSlider(value.measurement);
        this.behaviors.current.next({ ...this.behaviors.current.value!, value });
    }

    /**
     * Updates filter.
     * @param value Next filter value
     */
    setFilter(value: any) {
        this.behaviors.filter.next({ ...this.behaviors.filter.value!, value });
    }

    /**
     * Updates rmsd if current exists.
     * @param values Next rmsd value
     */
    setRmsd(values: any) {
        const current = this.behaviors.current.value?.value as { measurement: string };
        const plotInfo = this.getPlotInfo(current.measurement);
        if (!plotInfo) return;

        this.behaviors.rmsd.next(values);
    }

    /**
     * Updates frame.
     * @param values Next frame value
     */
    setFrame(values: any) {
        this.behaviors.frame.next({ ...this.behaviors.frame.value!, value: values });
    }
    /**
     * @returns id of current
     */
    getCurrentId(): string {
        const current = this.behaviors.current.value?.value as { measurement: string };
        return current.measurement;
    }

    /**
     * @returns Filter values [number, number]
     */
    getFilter(): [number, number] {
        const filter = this.behaviors.filter.value?.value as { filter: Array<number> };
        return [filter.filter[0], filter.filter[1]];
    }

    /**
     * Adds distance.
     * @param data DistanceData
     * @param id State tree object id
     */
    async addDistance(data: DistanceData, id: string) {
        const [lA, lB] = data.pairs[0].loci.map(l => {
            return l as StructureElement.Loci;
        });
        if (!this.sameTrajectory([lA, lB])) return;

        const t = this.getTrajectory(lA);
        const task = calculateDistances([lA, lB], t.trajectory!);
        const values = await this.plugin.runTask(task, { useOverlay: false });
        const distance: PlotInfo = {
            trajectory: t.trajectory!,
            trajectoryRef: t.trajectoryRef!,
            locis: [lA, lB],
            values: values,
            min: arrayMin(values.map(v => v.value)),
            max: arrayMax(values.map(v => v.value)),
            id: id
        };
        const d = this.behaviors.distances.value;
        d.push(distance);
        this.behaviors.distances.next(d);
    }

    /**
     * Adds angle.
     * @param data AngleData
     * @param id State tree object id
     */
    async addAngle(data: AngleData, id: string) {
        const [lA, lB, lC] = data.triples[0].loci.map(l => {
            return l as StructureElement.Loci;
        });
        if (!this.sameTrajectory([lA, lB, lC])) return;

        const t = this.getTrajectory(lA);
        const task = calculateAngles([lA, lB, lC], t.trajectory!);
        const values = await this.plugin.runTask(task, { useOverlay: false });
        const angle: PlotInfo = {
            trajectory: t.trajectory!,
            trajectoryRef: t.trajectoryRef!,
            locis: [lA, lB, lC],
            values: values,
            min: arrayMin(values.map(v => v.value)),
            max: arrayMax(values.map(v => v.value)),
            id: id
        };
        const a = this.behaviors.angles.value;
        a.push(angle);
        this.behaviors.angles.next(a);
    }

    /**
     * Adds dihedral.
     * @param data DihedralData
     * @param id State tree object id
     */
    async addDihedral(data: DihedralData, id: string) {
        const [lA, lB, lC, lD] = data.quads[0].loci.map(l => {
            return l as StructureElement.Loci;
        });
        if (!this.sameTrajectory([lA, lB, lC, lD])) return;

        const t = this.getTrajectory(lA);
        const task = calculateDihedrals([lA, lB, lC, lD], t.trajectory!);
        const values = await this.plugin.runTask(task, { useOverlay: false });
        const dihedral: PlotInfo = {
            trajectory: t.trajectory!,
            trajectoryRef: t.trajectoryRef!,
            locis: [lA, lB, lC, lD],
            values: values,
            min: arrayMin(values.map(v => v.value)),
            max: arrayMax(values.map(v => v.value)),
            id: id
        };
        const d = this.behaviors.dihedrals.value;
        d.push(dihedral);
        this.behaviors.dihedrals.next(d);
    }

    /**
     * Checks if loci are present within the same trajectory.
     * @param l Loci
     * @returns boolean
     */
    sameTrajectory(l: StructureElement.Loci[]): boolean {
        if (l.length === 0) return false;
        const t = this.getTrajectory(l[0]);
        if (!t.trajectory || !t.trajectoryRef) return false;
        for (let i = 1; i < l.length; i++) {
            const cT = this.getTrajectory(l[i]);
            if (!cT.trajectory || !cT.trajectoryRef) return false;
            if (t.trajectoryRef !== cT.trajectoryRef) {
                return false;
            }
        }
        return true;
    }

    /**
     * Return trajectory and trajectory ref in which the loci is present.
     * Trajectory and trajectoryRef are undefined if loci has no corresponding values.
     * @param l Loci
     * @returns Trajectory and trajectory ref
     */
    getTrajectory(l: StructureElement.Loci) {
        const model = l.structure.model;
        let trajectory;
        let trajectoryRef;

        const state = this.plugin.state.data;
        const models = state.selectQ(q => q.ofTransformer(StateTransforms.Model.ModelFromTrajectory));
        for (const m of models) {
            if (!m.sourceRef || !m.obj) continue;
            if (m.obj.data.id === model.id) {
                const parent = StateSelection.findAncestorWithTransformer(state.tree, state.cells, m.transform.ref, [StateTransforms.Model.TrajectoryXTCFromModelAndServer, StateTransforms.Model.TrajectoryFromModelAndCoordinates]);
                if (!parent || !parent.obj) continue;
                trajectory = parent.obj.data;
                trajectoryRef = parent.transform.ref;
            }
        }
        return { trajectory, trajectoryRef };
    }

    /**
     * Removed distance from distance list.
     * @param id State tree object id
     */
    async removeDistance(id: string) {
        const distances = this.behaviors.distances.value;
        for (let i = 0; i < distances.length; i++) {
            if (distances[i].id === id) {
                distances.splice(i, 1);
            }
        }
        this.behaviors.distances.next(distances);
    }

    /**
     * Removed angle from angle list.
     * @param id State tree object id
     */
    async removeAngle(id: string) {
        const angles = this.behaviors.angles.value;
        for (let i = 0; i < angles.length; i++) {
            if (angles[i].id === id) {
                angles.splice(i, 1);
            }
        }
        this.behaviors.angles.next(angles);
    }

    /**
     * Removed dihedral from dihedral list.
     * @param id State tree object id
     */
    async removeDihedral(id: string) {
        const dihedrals = this.behaviors.dihedrals.value;
        for (let i = 0; i < dihedrals.length; i++) {
            if (dihedrals[i].id === id) {
                dihedrals.splice(i, 1);
            }
        }
        this.behaviors.dihedrals.next(dihedrals);
    }

    /**
     * Returns PlotInfo for given id.
     * Undefined if no PlotInfo with this id.
     * @param id State tree object id
     * @returns PlotInfo or undefined
     */
    getPlotInfo(id: string) {
        if (id === '') return;
        const distances = this.behaviors.distances.value;
        for (let i = 0; i < distances.length; i++) {
            if (id === distances[i].id) {
                return distances[i];
            }
        }
        const angles = this.behaviors.angles.value;
        for (let i = 0; i < angles.length; i++) {
            if (id === angles[i].id) {
                return angles[i];
            }
        }
        const dihedrals = this.behaviors.dihedrals.value;
        for (let i = 0; i < dihedrals.length; i++) {
            if (id === dihedrals[i].id) {
                return dihedrals[i];
            }
        }
    }

    /**
     * Checks if idis present in PlotInfo of list.
     * @param id Object id
     * @param list List with PlotInfo
     * @returns boolean
     */
    idIn(id: string, list: PlotInfo[]) {
        for (let i = 0; i < list.length; i++) {
            if (id === list[i].id) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns task for calculating the line plot values of current selected measurement.
     * @returns Task
     */
    generateValues() {
        const task = Task.create('Generate Line Chart', async ctx => {
            try {
                const currentId = this.getCurrentId();
                const plotInfo = this.getPlotInfo(currentId);
                if (!plotInfo) return { values: [], tRef: '' };
                let values: PlotValue[] = [];
                if (!this.behaviors.rmsd.value.rmsd) {
                    values = plotInfo.values;
                } else {
                    const rmsdFrame = this.behaviors.frame.value?.value as {frame: number};
                    if (!rmsdFrame) return { values: [], tRef: '' };
                    const frame = rmsdFrame.frame - 1;
                    if (frame < 0) return { values: [], tRef: '' };
                    const task = calculateRmsd(plotInfo.trajectory, frame);
                    values = await this.plugin.runTask(task, { useOverlay: false });
                }

                const sorting = this.behaviors.sorting.value.sorting;
                const sortedValues = sortPlot(values, sorting);

                let filteredValues = [];
                if (this.behaviors.rmsd.value.rmsd) {
                    filteredValues = sortedValues;
                } else {
                    const [min, max] = this.getFilter();
                    filteredValues = filterPlot(sortedValues, min, max);
                }

                return { values: filteredValues, tRef: plotInfo.trajectoryRef };
            } catch (e) {
                this.plugin.log.error('' + e);
                throw e;
            }
        });

        return this.plugin.runTask(task, { useOverlay: false });
    }

    /**
     * Default current params if measurement type has no measurements.
     * @param type Measurement type
     */
    private defaultCurrent(type: string) {
        const measure = type.charAt(0).toUpperCase() + type.slice(1);
        const param = { measurement: PD.Select('empty', [['empty', `No ${type}s`]], { label: `${measure}` }) };
        const value = PD.getDefaultValues(param);
        this.behaviors.current.next({ type: type, param, value });
    }

    /** Default filter values when no measurement exists. */
    private defaultFilter() {
        const param = { filter: PD.Interval([0, 0], { min: 0, max: 0, step: 1 }, { label: 'Filter' }) };
        const value = PD.getDefaultValues(param);
        this.behaviors.filter.next({ param, value });
    }

    /** Default frame value when no measurement exists. */
    private defaultFrame() {
        const param = { frame: PD.Numeric(0, { min: 0, max: 0, step: 1 }, { label: 'Compare Frame' }) };
        const value = PD.getDefaultValues(param);
        this.behaviors.frame.next({ param, value });
    }

    private init() {
        this.subscribe(this.plugin.state.events.object.created, ({ obj }) => {
            if (obj.label === 'Distance' && obj.type.typeClass === 'Representation3D') {
                this.addDistance(obj.data.sourceData, obj.id);
            } else if (obj.label === 'Angle' && obj.type.typeClass === 'Representation3D') {
                this.addAngle(obj.data.sourceData, obj.id);
            } else if (obj.label === 'Dihedral' && obj.type.typeClass === 'Representation3D') {
                this.addDihedral(obj.data.sourceData, obj.id);
            }
        });

        this.subscribe(this.plugin.state.events.object.removed, ({ obj }) => {
            if (!obj) return;
            if (obj.label === 'Distance' && obj.type.typeClass === 'Representation3D') {
                this.removeDistance(obj.id);
            } else if (obj.label === 'Angle' && obj.type.typeClass === 'Representation3D') {
                this.removeAngle(obj.id);
            } else if (obj.label === 'Dihedral' && obj.type.typeClass === 'Representation3D') {
                this.removeDihedral(obj.id);
            }
        });

        const merged = merge(
            this.behaviors.distances,
            this.behaviors.angles,
            this.behaviors.dihedrals
        );

        // Update information when new measurement is added.
        this.subscribe(merged, async () => {
            if (this.behaviors.current.value?.type) {
                this.setType(this.behaviors.current.value?.type);
            }
        });

        this.initParams();
    }

    private initParams() {
        this.defaultCurrent('distance');
        this.defaultFilter();
        this.defaultFrame();
    }

    constructor(private plugin: PluginContext) {
        super();

        this.init();
    }
}

