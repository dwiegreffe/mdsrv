/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import React from 'react';
import { StateTransforms } from '../../mol-plugin-state/transforms';
import { ModelFromTrajectory } from '../../mol-plugin-state/transforms/model';
import { PluginUIComponent } from '../../mol-plugin-ui/base';
import { PluginCommands } from '../../mol-plugin/commands';
import { StateTransformer } from '../../mol-state';
import { UUID } from '../../mol-util';
import { arrayMax, arrayMin } from '../../mol-util/array';
import { loose_label } from './helper';
import { PlotValue, SkipToFrame, textWidth } from './measurement';
import { PlotParams } from './ui';

interface PlotState {
    hover: number,
    current: number
}

interface PlotProps {
    values?: PlotValue[],
    dict?: number[],
    trajectoryRef?: string,
    measurementType?: string,
    measurementUnit?: string,
    plotParams?: PlotParams,
}

export class LinePlot extends PluginUIComponent<PlotProps, PlotState> {
    state = { hover: -1, current: -1 };

    // plot height in pixel
    private plotHeight: number = 200;
    // spacing for x values
    private xSpacing: number = 4;
    private topPadding: number = 10;

    private grid: React.SVGProps<SVGLineElement>[] = [];
    private xTicks: React.SVGProps<SVGTextElement>[] = [];
    private yTicks: React.SVGProps<SVGTextElement>[] = [];
    private path: string = '';
    // min value in props.values
    private plotMin: number = -Infinity;
    // max value in props.values
    private plotMax: number = Infinity;

    componentDidMount() {
        this.subscribe(this.plugin.state.data.events.changed, this.updateCurrent);
        this.subscribe(this.plugin.behaviors.state.isAnimating, this.updateCurrent);
    }

    get values() {
        if (!this.props.values) return [];
        return this.props.values.map(v => { return v.value; });
    }

    private createPath(plot: number[]) {
        if (plot.length === 0) return '';

        let path: string = '';
        const min = this.plotMin;
        const max = this.plotMax;
        const scale: number = this.plotHeight / (max - min);

        if (plot.length === 1) {
            const x1 = (this.xSpacing * 1);
            const x2 = 0;
            const y = Math.floor((plot[0] - max) * -1 * scale) + this.topPadding;
            return 'M ' + x1 + ',' + y + 'L ' + x2 + ',' + y;
        }

        const x = (this.xSpacing * 1);
        const y = Math.floor((plot[0] - max) * -1 * scale) + this.topPadding;
        path += 'M ' + x + ',' + y;

        for (let i = 1; i < plot.length; i++) {
            const x = (this.xSpacing * (i + 1));
            const y = Math.floor((plot[i] - max) * -1 * scale) + this.topPadding;
            const next = ' L ' + x + ',' + y;
            path += next;
        }

        return path;
    }

    /** Set all attributes for line plot. */
    private linePlot() {
        const values = this.values;
        this.yTicks = this.yAxisTicks(values);
        this.xTicks = this.xAxisTicks();
        this.grid = this.plotGrid();
        this.path = this.createPath(values);
    }

    private plotGrid() {
        const horizontalLines: React.SVGProps<SVGLineElement>[] = this.xAxisGrid();
        const verticalLines: React.SVGProps<SVGLineElement>[] = this.yAxisGrid();
        const lines: React.SVGProps<SVGLineElement>[] = horizontalLines.concat(verticalLines);
        return lines;
    }

    private yAxisGrid() {
        const lines: React.SVGProps<SVGLineElement>[] = [];
        const y1 = this.topPadding;
        const y2 = this.topPadding + this.plotHeight;
        const spacing = this.props.plotParams?.labeling ? this.props.plotParams?.ticks : 10;
        const lineSpacing = this.props.plotParams?.labeling ? this.xSpacing * spacing : this.xSpacing * 10;
        const width = this.props.values?.length!;
        const num = width % spacing === 0 ? width / spacing + 1 : width / spacing;

        // base axis line
        lines.push(<line key={UUID.create22()} x1={0} y1={y1} x2={0} y2={y2} stroke={'gray'}></line>);

        for (let i = 1; i < num; i++) {
            const x = i * lineSpacing;
            lines.push(<line key={UUID.create22()} x1={x} y1={y1} x2={x} y2={y2}
                stroke={`${this.props.plotParams?.gridColor}`}
                strokeDasharray={`${this.props.plotParams?.gridDash} ${this.props.plotParams?.gridDash}`}
                strokeOpacity={`${this.props.plotParams?.gridOpacity}`}
                strokeWidth={'0.5'}></line>);
        }

        return lines;
    }

    private xAxisGrid() {
        const lines: React.SVGProps<SVGLineElement>[] = [];
        const width = this.props.values?.length!;

        // base axis line
        lines.push(<line key={UUID.create22()} x1={0} y1={this.topPadding + this.plotHeight} x2={width * this.xSpacing} y2={this.topPadding + this.plotHeight} stroke={'gray'}></line>);

        const lineSpacing = this.plotHeight / (this.yTicks.length - 1);
        for (let i = 0; i < this.yTicks.length - 1; i++) {
            lines.push(<line key={UUID.create22()} x1={0} y1={this.topPadding + lineSpacing * i}
                x2={width * this.xSpacing} y2={this.topPadding + lineSpacing * i}
                stroke={`${this.props.plotParams?.gridColor}`}
                strokeDasharray={`${this.props.plotParams?.gridDash} ${this.props.plotParams?.gridDash}`}
                strokeOpacity={`${this.props.plotParams?.gridOpacity}`}
                strokeWidth={'0.5'}></line>);
        }
        return lines;
    }

    private xAxisTicks() {
        const labels: React.SVGProps<SVGTextElement>[] = [];
        const width = this.props.values?.length!;
        const spacing = this.props.plotParams?.labeling ? this.props.plotParams?.ticks : 10;
        const tickSpacing = this.props.plotParams?.labeling ? this.xSpacing * spacing : this.xSpacing * 10;
        const y = this.plotHeight + this.topPadding + 18;
        const num = width % spacing === 0 ? width / spacing + 1 : width / spacing;

        const value = this.props.plotParams?.labeling ? this.props.plotParams.duration : 1;
        // const unit = this.props.plotParams?.duration ? this.props.plotParams.unit : '';

        for (let i = 1; i < num; i++) {
            const x = tickSpacing * i;
            const label = value * i * spacing;
            labels.push(<text key={UUID.create22()} className='plot-label' x={x} y={y}> {`${label.toFixed(this.props.plotParams?.fixed)}`} </text>);
        }

        return labels;
    }

    private yAxisTicks(values: number[]) {
        const labels: React.SVGProps<SVGTextElement>[] = [];
        const min: number = Math.floor(arrayMin(values));
        const max: number = Math.ceil(arrayMax(values));
        const xPos = 18;

        let ticks = [];
        if ((max - min) <= 10) {
            for (let i = min; i <= max; i++) {
                ticks.push(`${i}`);
            }
        } else {
            ticks = loose_label(min, max);
        }

        const tmpTicks = ticks.map(t => parseFloat(t));
        this.plotMin = arrayMin(tmpTicks);
        this.plotMax = arrayMax(tmpTicks);

        const tickSpacing = this.plotHeight / (ticks.length - 1);
        for (let i = 0; i < ticks.length; i++) {
            labels.push(<text key={UUID.create22()} className='plot-label' x={xPos} y={(this.topPadding + 4) + tickSpacing * i}> {ticks[ticks.length - (i + 1)]} </text>);
        }

        return labels;
    }

    private marker(values: number[], dict: number[]) {
        if (this.state.current === -1) return null;

        const x = this.x(dict[this.state.current] + 1);
        const y = this.y(dict[this.state.current], values);
        return <g>
            <circle stroke='red' fill='transparent' cx={x} cy={y} r='6.5' ></circle>
            <circle stroke='red' fill='red' cx={x} cy={y} r='4' ></circle>
        </g>;
    }

    private updateCurrent = () => {
        if (!this.props.trajectoryRef) {
            this.setState({ current: -1 });
            return;
        }
        const state = this.plugin.state.data;
        const models = state.selectQ(q => q.ofTransformer(StateTransforms.Model.ModelFromTrajectory));
        if (models.length === 0) {
            this.setState({ current: -1 });
            return;
        }

        for (const m of models) {
            if (!m.sourceRef) continue;
            const parent = state.cells.get(m.sourceRef)!;

            if (parent.transform.ref === this.props.trajectoryRef) {
                const index = (m.transform.params! as StateTransformer.Params<ModelFromTrajectory>).modelIndex;
                this.setState({ current: index });
                return;
            }
        }
        this.setState({ current: -1 });
    };

    private hover(values: number[]) {
        if (this.state.hover === -1) return;
        const hover = this.state.hover;
        const x = this.x(hover + 1);
        const y = this.y(hover, values);
        return <g>
            <circle stroke={this.props.plotParams?.hoverColor} fill='transparent' cx={x} cy={y} r='6.5' ></circle>
            <circle stroke={this.props.plotParams?.hoverColor} fill={this.props.plotParams?.hoverColor} cx={x} cy={y} r='4' ></circle>
            {this.hoverLabel(x, y)}
        </g>;
    }

    private hoverLabel(x: number, y: number) {
        const [frameText, valueText, width] = this.infoLabelText()!;
        const height = 50;

        return <g>
            <rect x={x + 10} y={y - 15} width={width} height={height} rx='5'fill='black' fillOpacity='0.7' />
            <polygon points={`${x + 10},${y - 5} ${x + 10},${y + 5} ${x + 5},${y}`} fill='black' fillOpacity='0.7' />
            <text id='frameLabel' className='plot-hover-label' x={x + 15} y={y + 5} >{frameText}</text>
            <text id='measureLabel' className='plot-hover-label' x={x + 15} y={y + 22} >{valueText}</text>
        </g>;
    }

    private infoLabelText(): [string, string, number] {
        if (this.state.hover === -1) return ['', '', 0];
        const measurement = this.props.measurementType!.charAt(0).toUpperCase() + this.props.measurementType!.slice(1);
        const frameText = `Frame: ${this.props.values![this.state.hover].frame + 1}`;
        const valueText = `${measurement}: ${this.props.values![this.state.hover].value.toFixed(2)} ${this.props.measurementUnit}`;
        let width = Math.max(textWidth(frameText)!, textWidth(valueText)!);
        width = width ? width + 15 : 150;
        return [frameText, valueText, width];
    }

    private x = (i: number) => {
        return this.xSpacing * i;
    };

    private y(i: number, values: number[]) {
        const min = this.plotMin;
        const max = this.plotMax;
        const scale: number = this.plotHeight / (max - min);
        return (Math.floor((values[i] - max) * -1 * scale) + this.topPadding);
    }

    mouseMove = (e: React.MouseEvent) => {
        const bound = e.currentTarget.getBoundingClientRect();
        const x = e.pageX - bound.x;
        const plotX = Math.floor((x) / this.xSpacing);

        if (0 <= plotX && plotX < this.props.values!.length) {
            this.setState({ hover: plotX });
        } else {
            this.setState({ hover: -1 });
        }
    };

    mouseLeave = (e: React.MouseEvent) => {
        this.setState({ hover: -1 });
    };

    onClick = (e: React.MouseEvent) => {
        const bound = e.currentTarget.getBoundingClientRect();
        const x = e.pageX - bound.x;
        const plotX = Math.floor(x / this.xSpacing);
        if (this.props.values!.length < plotX) return;
        const frame = this.props.values![plotX].frame;

        if (0 <= plotX && plotX < this.props.values!.length) {
            this.skip(frame);
        }
    };

    skip = (frame: number) => PluginCommands.State.ApplyAction(this.plugin, {
        state: this.plugin.state.data,
        action: SkipToFrame.create({ trajRef: this.props.trajectoryRef!, skip: frame })
    });

    render() {
        const values = this.props.values;
        if (!values || values.length === (0 || 1) || !this.props.trajectoryRef || !this.props.plotParams || !this.props.dict) return null;
        this.linePlot();
        const width = this.infoLabelText()[2];
        const plotWidth = values.length * this.xSpacing + width + 100;

        return <div className='msp-plot'>
            <svg className='msp-plot-left-label'><g>{this.yTicks}</g></svg>
            <div className='msp-plot-path-container'>
                <svg className='msp-plot-path'
                    width={plotWidth}
                    onMouseMove={this.mouseMove}
                    onMouseLeave={this.mouseLeave}
                    onClick={this.onClick}
                >
                    {this.grid}
                    {this.xTicks}
                    <g><path d={this.path} strokeWidth='2' stroke={this.props.plotParams.lineColor} fill='none' /></g>
                    {this.marker(this.values, this.props.dict)}
                    {this.hover(this.values)}
                </svg>
            </div>
        </div>;
    }
}