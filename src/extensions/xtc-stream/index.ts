/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { PluginBehavior } from '../../mol-plugin/behavior';
import { XTCStreamTrajectory } from './trajectory';

export const XTCStream = PluginBehavior.create<{ }>({
    name: 'xtc-stream',
    category: 'misc',
    display: {
        name: 'Xtc Stream',
        description: 'Add Trajectory with data stream.'
    },
    ctor: class extends PluginBehavior.Handler<{ }> {
        register(): void {
            this.ctx.customBottomPanels.set('xtc-stream', XTCStreamTrajectory as any);
        }

        update() {
            return false;
        }

        unregister() {
            this.ctx.customBottomPanels.delete('xtc-stream');
        }
    },
});