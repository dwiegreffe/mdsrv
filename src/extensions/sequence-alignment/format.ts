/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { DataFormatProvider } from '../../mol-plugin-state/formats/provider';
import { PluginStateObject, PluginStateObject as SO, PluginStateTransform } from '../../mol-plugin-state/objects';
import { Task } from '../../mol-task';
import { Clustal, clustalFromClustal } from './clustal';
import { parseClustal } from './parser';
import { ParamDefinition as PD } from '../../mol-util/param-definition';
import { getAlignment } from './alignments';
import { Structure } from '../../mol-model/structure';
import { PluginContext } from '../../mol-plugin/context';

export interface AlignmentFormatProvider<P extends {}, R extends {}> extends DataFormatProvider<P, R> {}

export const AlignmentFormatCategory = 'Alignment';

export const ClustalProvider: DataFormatProvider = {
    label: 'CLUSTAL',
    description: 'CLUSTAL',
    category: AlignmentFormatCategory,
    stringExtensions: ['als', 'aln', 'clw'],
    parse: async (plugin, data) => {
        const clustal = plugin.state.data.build()
            .to(data)
            .apply(ClustalAlignment);

        return clustal.commit();
    }
};

export type ClustalAlignment = typeof ClustalAlignment
export const ClustalAlignment = PluginStateTransform.BuiltIn({
    name: 'clustal-from-clustal',
    display: { name: 'Parse Clustal', description: 'Parse Clustal string data.' },
    from: [SO.Data.String],
    to: SO.Alignment.Clustal
})({
    apply({ a }) {
        return Task.create('Parse Clustal', async ctx => {
            const parsed = await parseClustal(a.data).runInContext(ctx);
            if (parsed.isError) throw new Error(parsed.message);
            const clustal = await clustalFromClustal(parsed.result).runInContext(ctx);
            return new SO.Alignment.Clustal(clustal, { label: a.label, description: 'Clustal' });
        });
    }
});

export type AlignmentFromClustalAndStructures = typeof AlignmentFromClustalAndStructures
export const AlignmentFromClustalAndStructures = PluginStateTransform.BuiltIn({
    name: 'alignment-from-clustal-and-structures',
    display: { name: 'Alignment from Clustal & Structures', description: 'Create an alignment from existing clustal and structures.' },
    from: SO.Root,
    to: SO.Alignment.Alignment,
    params: {
        clustalRef: PD.Text('', { isHidden: true }),
        match: PD.Value<(string|number)[][]>([], { isHidden: true })
    }
})({
    apply({ params, dependencies }, plugin: PluginContext) {
        return Task.create('Create an alignment from existing clustal and structures.', async ctx => {
            const clustal = dependencies![params.clustalRef].data as Clustal;
            const structures: Structure[] = [];
            for (let i = 0; i < params.match.length; i++) {
                structures.push(dependencies![params.match[i][4]].data as Structure);
            }
            const label = dependencies![params.clustalRef].label;
            const alignment = getAlignment(params.match, structures, clustal, label, plugin.managers.structure.selection);
            return new PluginStateObject.Alignment.Alignment(alignment, { label: `Alignment ${label}` });
        });
    }
});
