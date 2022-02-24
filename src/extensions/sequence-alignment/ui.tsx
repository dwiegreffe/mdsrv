/**
 * Copyright (c) 2018-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 *
 * parts adapted from /src/mol-plugin-ui/sequence.tsx
 */

import { PluginStateObject } from '../../mol-plugin-state/objects';
import { CollapsableControls, CollapsableState, PurePluginUIComponent } from '../../mol-plugin-ui/base';
import { CheckSvg, ClearAllSvg, MoreHorizSvg } from '../../mol-plugin-ui/controls/icons';
import { getChainOptions, getModelEntityOptions, getOperatorOptions, getSequenceWrapper, getStructureOptions } from '../../mol-plugin-ui/sequence';
import { SequenceWrapper } from '../../mol-plugin-ui/sequence/wrapper';
import { AlignmentFromClustalAndStructures, ClustalAlignment } from './format';
import { ParamDefinition as PD } from '../../mol-util/param-definition';
import { ParameterControls, SelectControl } from '../../mol-plugin-ui/controls/parameters';
import { State } from '../../mol-state';
import { Structure } from '../../mol-model/structure';
import { Button, IconButton } from '../../mol-plugin-ui/controls/common';
import { PluginCommands } from '../../mol-plugin/commands';
import { SequenceAlignmentControls } from './controls';
import { merge } from 'rxjs';
import { Alignment } from './alignments';
import { AlignmentSequence } from './sequence';
import React from 'react';
import { HelpGroup, HelpText } from '../../mol-plugin-ui/viewport/help';

require('./alignment.scss');

interface State_ {
    busy?: boolean,
    alignmentRef?: string
}

// choose and display sequence alignment
export class SequenceAlignmentUI extends CollapsableControls<{}, State_> {
    private _controls: SequenceAlignmentControls | undefined;

    get controls() {
        return this._controls || (this._controls = new SequenceAlignmentControls(this.plugin));
    }

    protected defaultState(): State_ & CollapsableState {
        return {
            header: 'Sequence Alignment',
            isCollapsed: true,
            brand: { accent: 'cyan', svg: ClearAllSvg },
            isHidden: false,
            hoverInfo: 'Display alignment sequences'
        };
    }

    // alignment encoding
    alignment(a: string) {
        let n = '';
        for (let i = 0; i < a.length; i++) {
            switch (a.charAt(i)) {
                case ' ': n += '\u200b\u0020\u200b'; break;
                case '*': n += '\u200b\u002a\u200b'; break;
                case ':': n += '\u200b\u003a\u200b'; break;
                case '.': n += '\u200b\u002e\u200b'; break;
                default: n += '\u200b\u200b';
            }
        }
        return n;
    }

    renderAlignment() {
        const currentRef = this.controls.behaviors.current.value;

        const alignments = this.plugin.state.data.selectQ(q => q.rootsOfType(PluginStateObject.Alignment.Alignment));
        let alignment: Alignment | undefined;
        for (const a of alignments) {
            if (!a.obj?.data) continue;
            if (currentRef === a.transform.ref) {
                alignment = a.obj.data;
                break;
            }
        }
        if (!alignment) return null;

        const labels = [];
        const sequences = [];

        alignment.wrapper.forEach((w, i) => {
            const wrapper = w.wrapper;
            const elem = typeof wrapper === 'string'
                ? <div key={i} className='msp-alignment-sequence msp-sequence-wrapper'>{w}</div>
                : <div><AlignmentSequence key={i} sequenceWrapper={wrapper} sequenceAlignment={w.alignmentSequence} index={w.startIndex} hideSequenceNumbers={true} /></div>;

            const lab = <div className='msp-alignment-label msp-sequence-chain-label'>{w.chainLabel}</div>;

            labels.push(<React.Fragment key={i}>
                {lab}
            </React.Fragment>);

            sequences.push(<React.Fragment key={i}>
                {elem}
            </React.Fragment>);
        });

        labels.push(
            <React.Fragment key={alignment.wrapper.length}>
                <div className='msp-alignment-label msp-sequence-chain-label'>Alignment</div>
            </React.Fragment>
        );

        sequences.push(
            <React.Fragment key={alignment.wrapper.length}>
                <div key={alignment.wrapper.length} className='msp-alignment-sequence msp-sequence-wrapper'>{this.alignment(alignment.alignment)}</div>
            </React.Fragment>
        );

        return (<div className='msp-alignment-wrapper'>
            <div className='msp-alignment-label-container'>{labels}</div>
            <div className='msp-alignment-sequence-container'>{sequences}</div>
        </div>);
    }

    protected renderControls(): JSX.Element {
        const ctrl = this.controls;
        const alignments = ctrl.behaviors.alignments;
        const currentRef = ctrl.behaviors.current;

        return <>
            <ParameterControls
                params={alignments.value}
                values={{ alignment: currentRef.value }}
                onChangeValues={xs => { ctrl.setAlignment(xs.alignment); ctrl.alignStrucures(xs.alignment); }}
                isDisabled={this.state.busy}
            />
            <div className='msp-alignment'>
                {this.renderAlignment()}
            </div>
        </>;
    }

    componentDidMount() {
        const merged = merge(
            this.controls.behaviors.alignments,
            this.controls.behaviors.current
        );
        this.subscribe(merged, () => {
            this.forceUpdate();
        });
    }

    componentWillUnmount() {
        this._controls?.dispose();
        this._controls = void 0;
    }
}

// choose alignment and match its sequences to structures
export class MatchSequenceAlignmentUI extends CollapsableControls {

    defaultState() {
        return {
            header: 'Match Sequence Alignment',
            isCollapsed: true,
            brand: { accent: 'cyan' as const, svg: ClearAllSvg },
            hoverInfo: 'Matching an imported alignment with structures',
            isHidden: false
        };
    }

    renderControls() {
        return <>
            <MatchSequenceAlignmentControls />
            <HelpGroup header='Help'>
                <HelpText>Import an alignment file (Clustal, ClustalW) with the Open File Tool and import the corresponding molecular structures.
                    For each chain in the alignment, select the corresponding sequence in the structures and click Apply Matching.
                    Open the Sequence Alignment Tool to view the matched alignment.
                </HelpText>
            </HelpGroup>
        </>;
    }
}

function getAlignmentOptions(state: State) {
    const options: [string, string][] = [];
    const clustal = state.selectQ(q => q.rootsOfType(PluginStateObject.Alignment.Clustal));
    for (const c of clustal) {
        if (!c.obj?.data) continue;
        options.push([c.transform.ref, c.obj!.label]);
    }

    if (options.length === 0) options.push(['', 'No alignment']);
    return options;
}

function checkWrapper(wrapper: (string|SequenceWrapper.Any), sequence: string) {
    // remove all gaps from alignment sequence
    const n = sequence.replace(/[-]/g, '');

    // get sequence of wrapper
    let sWrapper: string = '';
    if (typeof wrapper !== 'string') {
        for (let i = 0; i < wrapper.length; i++) {
            const label = wrapper.residueLabel(i);
            sWrapper += label;
        }
    } else {
        sWrapper = wrapper;
    }

    // add wrapper if alignment sequence is substring of wrapper sequence
    if (sWrapper.includes(n)) {
        // start index of subsequence

        const index = sWrapper.indexOf(n);
        return index;
    }
    return -1;
}

type MatchSequenceAlignmentState = {
    alignmentOptions: [string, string][],
    alignmentRef: string,
    // current selected options for structures to match
    // match - select options
    // chain - chain label from alignment
    // sequence - sequence with gaps from alignment
    matchStates: Map<number, {match: MatchState, chain: string, sequence: string}>,
}

export class MatchSequenceAlignmentControls extends PurePluginUIComponent<{}, MatchSequenceAlignmentState> {
    state: MatchSequenceAlignmentState = { alignmentOptions: [], alignmentRef: '', matchStates: new Map() };

    componentDidMount() {
        this.sync();
        this.subscribe(this.plugin.state.events.cell.stateUpdated, e => {
            if (e.cell.transform.transformer === ClustalAlignment) this.sync();
        });
    }

    private sync() {
        const alignmentOptions = getAlignmentOptions(this.plugin.state.data);
        this.setState({ alignmentOptions: alignmentOptions, alignmentRef: alignmentOptions[0][0] });
    }

    matchStateChanged = (d: MatchState, chain: string, sequence: string, no: number) => {
        const map = this.state.matchStates;
        map.set(no, { match: d, chain, sequence });
        this.setState({ matchStates: map });
    };

    getClustalByRef(ref: string) {
        const clustal = this.plugin.state.data.selectQ(q => q.rootsOfType(PluginStateObject.Alignment.Clustal));
        for (const c of clustal) {
            if (!c.obj?.data) continue;
            if (c.transform.ref === ref) return c;
        }
    }

    // match controls for each chain in alignment
    matchControls(ref: string) {
        const clustal = this.getClustalByRef(ref);
        const controls: JSX.Element[] = [];

        if (!clustal) return controls;

        for (let i = 0; i < clustal.obj!.data.amount; i++) {
            const sequence = clustal.obj!.data.sequences[i];
            controls.push(<MatchControls key={i} chainLabel={sequence.chain} sequenceWithGaps={sequence.sequence} id={i} stateChanged={this.matchStateChanged} />);
        }

        return controls;
    }

    onAlignmentChanged = (p: { param: PD.Base<any>, name: string, value: any}) => {
        const state = { ... this.state };
        state.alignmentRef = p.value;
        this.setState(state);
    };

    // add new alignment cell
    async addAlignment(match: (string|number)[][], clustalRef: string) {
        const structureRefs: string[] = [];
        for (let i = 0; i < match.length; i++) {
            structureRefs.push(match[i][4] as string);
        }
        const dependsOn = structureRefs.concat(clustalRef);
        const alignment = this.plugin.state.data.build().toRoot()
            .apply(AlignmentFromClustalAndStructures, {
                clustalRef: clustalRef,
                match: match
            }, { dependsOn });

        const state = this.plugin.state.data;
        await PluginCommands.State.Update(this.plugin, { state, tree: alignment, options: { doNotLogTiming: true } });
        const label = this.getClustalByRef(clustalRef)?.obj?.label;
        this.plugin.log.message(`Alignment ${label} matched.`);
    }

    // get wrappers for selected sturtcures and check is matching is possible
    apply = () => {
        const wrapper: (string|number)[][] = [];

        this.state.matchStates.forEach((v, k) => {
            const w = getSequenceWrapper({
                structure: v.match.structure,
                modelEntityId: v.match.modelEntityId,
                chainGroupId: v.match.chainGroupId,
                operatorKey: v.match.operatorKey
            }, this.plugin.managers.structure.selection);

            // checks if the alignment without gaps is a substring of the sequence in the wrapper
            // index is start position of alignment sequence in the wrapper
            // -1 if not a substring
            const index = checkWrapper(w, v.sequence);

            if (index === -1) {
                this.plugin.log.error(`Wrong structure match for ${v.chain}.`);
            } else {
                const info = [
                    v.chain,
                    v.match.label,
                    v.sequence,
                    index,
                    v.match.structureRef,
                    v.match.modelEntityId,
                    v.match.chainGroupId,
                    v.match.operatorKey
                ];
                wrapper.push(info);
            }
        });

        if (this.getClustalByRef(this.state.alignmentRef)?.obj?.data.amount === wrapper.length) {
            const alignmentRef = this.state.alignmentRef;
            this.addAlignment(wrapper, alignmentRef);
        } else {
            this.plugin.log.error('Alignment not matched.');
        }
    };

    render() {
        if (!this.getClustalByRef(this.state.alignmentRef)) {
            return <>
                <div className='msp-flex-row'>
                    <p className='msp-label-empty'> No alignment to match </p>
                </div>
            </>;
        }

        const alignment = PD.Select(this.state.alignmentOptions[0][0], this.state.alignmentOptions, { longLabel: true });

        return <>
            <div>
                <SelectControl name={'alignment'} param={alignment} value={this.state.alignmentRef} onChange={this.onAlignmentChanged} />
                {this.matchControls(this.state.alignmentRef)}
                <Button icon={CheckSvg} className={`msp-btn-commit msp-btn-commit-on`} onClick={this.apply} style={{ marginTop: 1 }}>Apply Matching</Button>
            </div>
        </>;
    }
}

type MatchState = {
    structureOptions: { options: [string, string][], all: Structure[] },
    structure: Structure,
    structureRef: string,
    modelEntityId: string,
    chainGroupId: number,
    operatorKey: string,

    // label for all the options containing
    // structure label, entity label, chain label
    label: string,

    // toggle for showing the whole sequence with gaps as help text
    toggleHelpSequence: boolean,
}

type MatchProps = {
    // chain lable of sequence from alignment file
    chainLabel: string,
    // seqeunce with gaps from alignment file
    sequenceWithGaps: string,
    // number of sequence from alignment file used as id
    id: number,
    // callback for state change
    stateChanged: (cState: MatchState, chain: string, sequence: string, no: number) => void
}

// adapted from /src/mol-plugin-ui/sequence.tsx
export class MatchControls extends PurePluginUIComponent<MatchProps, MatchState> {

    state: MatchState = { structureOptions: { options: [], all: [] }, structure: Structure.Empty, structureRef: '', modelEntityId: '', chainGroupId: -1, operatorKey: '', label: '', toggleHelpSequence: false };

    componentDidMount() {
        this.subscribe(this.plugin.state.events.object.updated, ({ ref, obj }) => {
            if (ref === this.state.structureRef && obj && obj.type === PluginStateObject.Molecule.Structure.type && obj.data !== this.state.structure) {
                this.sync();
            }
        });

        this.subscribe(this.plugin.state.events.object.created, ({ obj }) => {
            if (obj && obj.type === PluginStateObject.Molecule.Structure.type) {
                this.sync();
            }
        });

        this.subscribe(this.plugin.state.events.object.removed, ({ obj }) => {
            if (obj && obj.type === PluginStateObject.Molecule.Structure.type && obj.data === this.state.structure) {
                this.sync();
            }
        });

        this.sync();
    }

    private sync() {
        this.setState(this.getInitialState());
        this.props.stateChanged(this.getInitialState(), this.props.chainLabel, this.props.sequenceWithGaps, this.props.id);
    }

    private getInitialState(): MatchState {
        const structureOptions = getStructureOptions(this.plugin.state.data);
        const structureRef = structureOptions.options[0][0];
        const sLabel = structureOptions.options[0][1];
        const structure = this.getStructure(structureRef);
        let [modelEntityId, eLabel] = getModelEntityOptions(structure)[0];
        let [chainGroupId, cLabel] = getChainOptions(structure, modelEntityId)[0];
        let operatorKey = getOperatorOptions(structure, modelEntityId, chainGroupId)[0][0];
        if (this.state.structure && this.state.structure === structure) {
            modelEntityId = this.state.modelEntityId;
            chainGroupId = this.state.chainGroupId;
            operatorKey = this.state.operatorKey;
        }
        const label = `${sLabel} | ${eLabel} | ${cLabel}`;
        return { structureOptions, structure, structureRef, modelEntityId, chainGroupId, operatorKey, toggleHelpSequence: false, label };
    }

    private get params() {
        const { structureOptions, structure, modelEntityId, chainGroupId } = this.state;
        const entityOptions = getModelEntityOptions(structure);
        const chainOptions = getChainOptions(structure, modelEntityId);
        const operatorOptions = getOperatorOptions(structure, modelEntityId, chainGroupId);

        return {
            structure: PD.Select(structureOptions.options[0][0], structureOptions.options, { longLabel: true }),
            entity: PD.Select(entityOptions[0][0], entityOptions, { longLabel: true }),
            chain: PD.Select(chainOptions[0][0], chainOptions, { longLabel: true, label: 'Chain' }),
            operator: PD.Select(operatorOptions[0][0], operatorOptions, { longLabel: true }),
        };
    }

    private get values(): PD.Values<MatchControls['params']> {
        return {
            structure: this.state.structureRef,
            entity: this.state.modelEntityId,
            chain: this.state.chainGroupId,
            operator: this.state.operatorKey,
        };
    }

    private getStructure(ref: string) {
        const state = this.plugin.state.data;
        const cell = state.select(ref)[0];
        if (!ref || !cell || !cell.obj) return Structure.Empty;
        return (cell.obj as PluginStateObject.Molecule.Structure).data;
    }

    private toggleHelp = () => {
        this.setState((state) => ({ toggleHelpSequence: !state.toggleHelpSequence }));
    };

    private onSelectChanged = (p: { param: PD.Base<any>, name: string, value: any }) => {
        const state: MatchState = this.setParamProps(p);
        this.props.stateChanged(state, this.props.chainLabel, this.props.sequenceWithGaps, this.props.id);
    };

    private getLabel(state: MatchState) {
        const sLabel = state.structure.label;
        const eLabel = getModelEntityOptions(state.structure)[0][1];
        const cLabel = getChainOptions(state.structure, state.modelEntityId)[0][1];
        const label = `${sLabel} | ${eLabel} | ${cLabel}`;
        return label;
    }

    private setParamProps = (p: { param: PD.Base<any>, name: string, value: any }) => {
        const state = { ...this.state };
        switch (p.name) {
            case 'structure':
                if (p.name === 'structure') state.structureRef = p.value;
                state.structure = this.getStructure(state.structureRef);
                state.modelEntityId = getModelEntityOptions(state.structure)[0][0];
                state.chainGroupId = getChainOptions(state.structure, state.modelEntityId)[0][0];
                state.operatorKey = getOperatorOptions(state.structure, state.modelEntityId, state.chainGroupId)[0][0];
                break;
            case 'entity':
                state.modelEntityId = p.value;
                state.chainGroupId = getChainOptions(state.structure, state.modelEntityId)[0][0];
                state.operatorKey = getOperatorOptions(state.structure, state.modelEntityId, state.chainGroupId)[0][0];
                break;
            case 'chain':
                state.chainGroupId = p.value;
                state.operatorKey = getOperatorOptions(state.structure, state.modelEntityId, state.chainGroupId)[0][0];
                break;
            case 'instance':
                state.operatorKey = p.value;
                break;
        }
        state.label = this.getLabel(state);
        this.setState(state);
        return state;
    };

    render() {
        if (this.state.structureOptions.options.length === 0) return null;

        const params = this.params;
        const values = this.values;

        return <>
            <div className='msp-flex-row'>
                <p className='msp-label-empty'>
                    <span>{`Sequence Alignment ${this.props.id + 1}: `}</span>
                    <span style={{ fontWeight: 'bold' }}>{`${this.props.chainLabel}`}</span>
                </p>
                <IconButton svg={MoreHorizSvg} title='Show sequence alignment chain.' onClick={this.toggleHelp} className='msp-form-control' flex />
            </div>
            {this.state.toggleHelpSequence && <div className='msp-accent-offset msp-help-text'>
                <div className='msp-help-description' style={{ wordBreak: 'break-all' }}>{`${this.props.sequenceWithGaps}`}</div>
            </div>}
            <div className='msp-control-offset'>
                <SelectControl param={params.structure} name='structure' value={values.structure} onChange={(e) => { this.onSelectChanged(e); }} />
                <SelectControl param={params.entity} name='entity' value={values.entity} onChange={(e) => { this.onSelectChanged(e); }} />
                <SelectControl param={params.chain} name='chain' value={values.chain} onChange={(e) => { this.onSelectChanged(e); }} />
                {params.operator.options.length > 1 && <>
                    <SelectControl param={params.operator} name='instance' value={values.operator} onChange={(e) => { this.onSelectChanged(e); }} />
                </>}
            </div>
        </>;
    }
}
