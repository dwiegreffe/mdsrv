/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { PluginBehavior } from '../../mol-plugin/behavior';
import { MatchSequenceAlignmentUI, SequenceAlignmentUI } from './ui';

export const SequenceAlignment = PluginBehavior.create<{ }>({
    name: 'extension-sequence-alignment',
    category: 'misc',
    display: {
        name: 'Sequence Alignment'
    },
    ctor: class extends PluginBehavior.Handler<{ }> {
        register(): void {
            this.ctx.customBottomPanels.set('match-sequence-alignment', MatchSequenceAlignmentUI as any);
            this.ctx.customBottomPanels.set('sequence-alignment', SequenceAlignmentUI as any);
        }

        update() {
            return false;
        }

        unregister() {
            this.ctx.customBottomPanels.delete('match-sequence-alignment');
            this.ctx.customBottomPanels.delete('sequence-alignment');
        }
    },
    params: () => ({ })
});