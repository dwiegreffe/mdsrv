/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { PluginComponent } from '../../mol-plugin-state/component';
import { PluginStateObject } from '../../mol-plugin-state/objects';
import { PluginContext } from '../../mol-plugin/context';
import { ParamDefinition as PD } from '../../mol-util/param-definition';
import { AlignmentFromClustalAndStructures } from './format';

export class SequenceAlignmentControls extends PluginComponent {

    readonly behaviors = {
        alignments: this.ev.behavior<PD.Params>({ }),
        current: this.ev.behavior<string>(''),
    };

    setAlignment(value: any) {
        this.behaviors.current.next(value);
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

