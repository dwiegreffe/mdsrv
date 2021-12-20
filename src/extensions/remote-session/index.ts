/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { PluginBehavior } from '../../mol-plugin/behavior/behavior';
import { RemoteSessionSnapshots } from './ui';

export const RemoteSession = PluginBehavior.create<{}>({
    name: 'extension-remote-session',
    category: 'misc',
    display: {
        name: 'Remote Session'
    },
    ctor: class extends PluginBehavior.Handler<{}> {
        register(): void {
            this.ctx.customBottomPanels.set('remote-session', RemoteSessionSnapshots as any);
        }

        update() {
            return false;
        }

        unregister() {
            this.ctx.customBottomPanels.delete('remote-session');
        }
    },
    params: () => ({ })
});