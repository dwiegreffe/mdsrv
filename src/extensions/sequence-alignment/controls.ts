/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { Mat4 } from '../../mol-math/linear-algebra';
import { QueryContext, StructureElement, StructureSelection } from '../../mol-model/structure';
import { alignAndSuperpose } from '../../mol-model/structure/structure/util/superposition';
import { PluginComponent } from '../../mol-plugin-state/component';
import { StructureSelectionQueries } from '../../mol-plugin-state/helpers/structure-selection-query';
import { PluginStateObject } from '../../mol-plugin-state/objects';
import { StateTransforms } from '../../mol-plugin-state/transforms';
import { LociEntry, SuperpositionTag } from '../../mol-plugin-ui/structure/superposition';
import { PluginContext } from '../../mol-plugin/context';
import { StateObjectRef, StateSelection } from '../../mol-state';
import { elementLabel, structureElementStatsLabel } from '../../mol-theme/label';
import { ParamDefinition as PD } from '../../mol-util/param-definition';
import { stripTags } from '../../mol-util/string';
import { Alignment } from './alignments';
import { AlignmentFromClustalAndStructures } from './format';

type AlignmentLocis = {
    loci: StructureElement.Loci,
    // structure ref
    sRef: string,
    // aligment sequence
    aSequence: string
}

export class SequenceAlignmentControls extends PluginComponent {

    readonly behaviors = {
        alignments: this.ev.behavior<PD.Params>({ }),
        current: this.ev.behavior<string>(''),
    };

    setAlignment(value: any) {
        this.behaviors.current.next(value);
    }

    get alignment() {
        const alignments = this.plugin.state.data.selectQ(q => q.rootsOfType(PluginStateObject.Alignment.Alignment));
        let align: Alignment | undefined;
        for (const a of alignments) {
            if (!a.obj?.data) continue;
            if (a.transform.ref === this.behaviors.current.value) {
                align = a.obj.data;
                return align;
            }
        }
    }

    getLocis(alignment: Alignment) {
        const aLocis: AlignmentLocis[] = [];

        for (let i = 0; i < alignment.wrapper.length; i++) {
            const wrapper = alignment.wrapper[i];
            if (typeof wrapper.wrapper === 'string') return;
            let j = wrapper.startIndex;
            let tmp: StructureElement.Loci | undefined;
            for (let i = 0; i < wrapper.alignmentSequence.length; i++) {
                const label = wrapper.alignmentSequence.charAt(i);
                if (label === '-') {
                } else {
                    if (!tmp) {
                        tmp = wrapper.wrapper.getLoci(j);
                    } else {
                        tmp = StructureElement.Loci.union(tmp, wrapper.wrapper.getLoci(j));
                    }
                    j++;
                }
            }
            if (!tmp) return;

            aLocis.push({
                loci: tmp,
                sRef: wrapper.structureRef,
                aSequence: wrapper.alignmentSequence
            });
        }
        return aLocis;
    }

    // adapted from /src/mol-plugin-ui/structure/superposition.tsx
    getEntries(aLocis: AlignmentLocis[]) {
        const entries: LociEntry[] = [];
        const location = StructureElement.Location.create();
        for (let i = 0; i < aLocis.length; i++) {
            const loci = aLocis[i].loci;
            const stats = StructureElement.Stats.ofLoci(loci);
            const counts = structureElementStatsLabel(stats, { countsOnly: true });
            const l = StructureElement.Loci.getFirstLocation(loci, location)!;
            const chain = elementLabel(l, { reverse: true, granularity: 'chain' }).split('|');
            const label = `${counts} | ${chain[0]} | ${chain[chain.length - 1]}`;

            entries.push({
                loci,
                label,
                cell: StateObjectRef.resolveAndCheck(this.plugin.state.data, aLocis[i].sRef)!
            });
        }
        return entries;
    }

    // taken from /src/mol-plugin-ui/structure/superposition.tsx
    async transform(s: StateObjectRef<PluginStateObject.Molecule.Structure>, matrix: Mat4) {
        const r = StateObjectRef.resolveAndCheck(this.plugin.state.data, s);
        if (!r) return;
        // TODO should find any TransformStructureConformation decorator instance
        const o = StateSelection.findTagInSubtree(this.plugin.state.data.tree, r.transform.ref, SuperpositionTag);

        const params = {
            transform: {
                name: 'matrix' as const,
                params: { data: matrix, transpose: false }
            }
        };
        // TODO add .insertOrUpdate to StateBuilder?
        const b = o
            ? this.plugin.state.data.build().to(o).update(params)
            : this.plugin.state.data.build().to(s)
                .insert(StateTransforms.Model.TransformStructureConformation, params, { tags: SuperpositionTag });
        await this.plugin.runTask(this.plugin.state.data.updateTree(b));
    }

    // adapted from /src/mol-plugin-ui/structure/superposition.tsx
    async alignStrucures(ref: string) {
        const alignment = this.alignment;
        if (!alignment) return;

        const { query } = StructureSelectionQueries.trace;
        const aLocis = this.getLocis(alignment);
        if (!aLocis) return;
        const entries = this.getEntries(aLocis);
        const traceLocis: StructureElement.Loci[] = [];
        const aSeq: string[] = [];

        for (let i = 0; i < aLocis.length; i++) {
            const a = aLocis[i];
            const s = StructureElement.Loci.toStructure(a.loci);
            const loci = StructureSelection.toLociWithSourceUnits(query(new QueryContext(s)));
            const root = this.plugin.helpers.substructureParent.get(a.loci.structure.root);
            if (!root) continue;
            traceLocis.push(StructureElement.Loci.remap(loci, i === 0
                ? root!.obj!.data
                : loci.structure.root
            ));
            aSeq.push(a.aSequence);
        };
        if (traceLocis.length === 0 || traceLocis.length !== aLocis.length) return;

        const transforms = alignAndSuperpose(traceLocis, aSeq);

        const eA = entries[0];
        for (let i = 1, il = aLocis.length; i < il; ++i) {
            const eB = entries[i];
            const { bTransform } = transforms[i - 1];
            await this.transform(eB.cell, bTransform);
            const labelA = stripTags(eA.label);
            const labelB = stripTags(eB.label);
            this.plugin.log.info(`Superposed [${labelA}] and [${labelB}] based on the matched alignment.`);
        }
    }

    sync() {
        const options: [string, string][] = [];
        const alignments = this.plugin.state.data.selectQ(q => q.rootsOfType(PluginStateObject.Alignment.Alignment));

        for (const a of alignments) {
            if (!a.obj?.data) continue;

            options.push([a.transform.ref, a.obj!.data.label]);
        }
        if (options.length === 0) options.push(['', 'No alignment']);
        const params = { alignment: PD.Select(options[0][0], options, { longLabel: true }) };
        const current = options[0][0];
        this.behaviors.alignments.next(params);
        this.behaviors.current.next(current);
        this.alignStrucures(current);
    }

    constructor(private plugin: PluginContext) {
        super();

        this.subscribe(this.plugin.state.events.cell.stateUpdated, e => {
            if (e.cell.transform.transformer === AlignmentFromClustalAndStructures) this.sync();
        });

        this.subscribe(this.plugin.state.events.cell.removed, e => {
            this.sync();
        });
        this.sync();
    }
}

