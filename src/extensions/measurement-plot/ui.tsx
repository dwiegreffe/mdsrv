/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { merge } from 'rxjs';
import { CollapsableControls, CollapsableState } from '../../mol-plugin-ui/base';
import { ExpandGroup } from '../../mol-plugin-ui/controls/common';
import { ShowChart } from '../../mol-plugin-ui/controls/icons';
import { ParameterControls } from '../../mol-plugin-ui/controls/parameters';
import { HelpGroup, HelpText } from '../../mol-plugin-ui/viewport/help';
import { Color } from '../../mol-util/color';
import { MeasurementParam, MeasurementLinePlotControls, PlotParams, RMSDParam, PlotSortingParam } from './controls';
import { PlotValue, unitLabel } from './measurement';
import { LinePlot } from './plot';

require('./plot.scss');

export interface PlotParams {
    labeling: boolean,
    ticks: number,
    duration: number,
    unit: string,
    fixed: number,
    lineColor: string,
    hoverColor: string,
    gridColor: string,
    gridOpacity: number,
    gridDash: number,
}

interface State {
    busy?: boolean,
    adding?: boolean,
    values?: PlotValue[],
    trajectoryRef?: string,
    dict?: number[],
}

export class MeasurementLinePlotUI extends CollapsableControls<{}, State> {
    private _controls: MeasurementLinePlotControls | undefined;

    get controls() {
        return this._controls || (this._controls = new MeasurementLinePlotControls(this.plugin));
    }

    protected defaultState(): State & CollapsableState {
        return {
            header: 'Time-trace Plot',
            isCollapsed: true,
            brand: { accent: 'cyan', svg: ShowChart },
            isHidden: false,
            hoverInfo: 'Line plot for a selected measurement over the whole trajectory'
        };
    }

    protected renderControls(): JSX.Element {
        const ctrl = this.controls;
        const current = ctrl.behaviors.current.value;
        const filter = ctrl.behaviors.filter.value;
        const rmsd = ctrl.behaviors.rmsd.value.rmsd;
        const frame = ctrl.behaviors.frame.value;

        const params = this.plotParams(ctrl.behaviors.plot.value);

        const measurement = (current && current.value.measurement !== ('empty' || undefined));

        return <>
            <ParameterControls
                params={MeasurementParam}
                values={{ measurement: current?.type }}
                onChangeValues={xs => ctrl.setType(xs.measurement)}
                isDisabled={this.state.busy}
            />
            {current && <ParameterControls
                params={current.param}
                values={current.value}
                onChangeValues={xs => ctrl.setCurrent(xs)}
                isDisabled={this.state.busy}
            />}
            {measurement && !rmsd && filter && <ParameterControls
                params={filter.param}
                values={filter.value}
                onChangeValues={xs => ctrl.setFilter(xs)}
                isDisabled={this.state.busy || this.state.adding}
            />}
            {measurement && rmsd && frame && <ParameterControls
                params={frame.param}
                values={frame.value}
                onChangeValues={xs => ctrl.setFrame(xs)}
                isDisabled={this.state.busy || this.state.adding}
            />}
            <ParameterControls
                params={RMSDParam}
                values={ctrl.behaviors.rmsd.value}
                onChangeValues={xs => ctrl.setRmsd(xs)}
                isDisabled={this.state.busy || this.state.adding}
            />
            <ParameterControls
                params={PlotSortingParam}
                values={ctrl.behaviors.sorting.value}
                onChangeValues={xs => ctrl.behaviors.sorting.next(xs)}
                isDisabled={this.state.busy || this.state.adding}
            />
            <ExpandGroup header='Plot Options'>
                <ParameterControls
                    params={PlotParams}
                    values={ctrl.behaviors.plot.value}
                    onChangeValues={xs => ctrl.behaviors.plot.next(xs)}
                    isDisabled={this.state.busy || this.state.adding}
                />
            </ExpandGroup>
            {measurement && <LinePlot
                values={this.state.values}
                dict={this.state.dict}
                trajectoryRef={this.state.trajectoryRef}
                measurementType={rmsd ? 'rmsd' : current?.type}
                measurementUnit={rmsd ? '' : unitLabel(current?.type!)}
                plotParams={params}
            />}
            <HelpGroup header='Plot Help'>
                <HelpText>Add a measurement (distance, angle, area) to a trajectory in the Measurements Structure Tool to display a line plot of the measurement's values across the entire trajectory.</HelpText>
                <HelpText>Click on a specific value in the line plot to skip to the corresponding frame.</HelpText>
                <HelpText>Select RMSD to display the RMSD values for the entire structure over the trajectory. Set a frame for comparison.</HelpText>
                <HelpText>Use the Plot Options to customize the appearance of the line plot.</HelpText>
                <HelpText>Select Custom Axis to manually set the spacing of the tick marks and the label.</HelpText>
            </HelpGroup>
        </>;
    }

    generateValues = async () => {
        try {
            this.setState({ busy: true });
            const values = await this.controls.generateValues();
            this.setState({ busy: false, values: values.values, trajectoryRef: values.tRef, dict: values.dict });
        } catch {
            this.setState({ busy: false });
        }
    };

    plotParams(value: any): PlotParams {
        return {
            labeling: value.labeling,
            ticks: value.ticks,
            duration: value.duration,
            unit: value.unit,
            fixed: value.fixed,
            lineColor: `#${Color.toHexString(value.lineColor).slice(2)}`,
            hoverColor: `#${Color.toHexString(value.hoverColor).slice(2)}`,
            gridColor: `#${Color.toHexString(value.gridColor).slice(2)}`,
            gridOpacity: value.gridOpacity,
            gridDash: value.gridDash,
        };
    }

    componentDidMount() {
        const merged = merge(
            this.controls.behaviors.current,
            this.controls.behaviors.sorting,
            this.controls.behaviors.filter,
            this.controls.behaviors.rmsd,
            this.controls.behaviors.frame,
            this.controls.behaviors.plot,
        );

        this.subscribe(merged, async => {
            this.generateValues();
        });

        this.subscribe(this.controls.behaviors.busy, async v => {
            this.setState({ adding: v });
        });
    }

    componentWillUnmount() {
        this._controls?.dispose();
        this._controls = void 0;
    }
}