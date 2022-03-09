/**
 * Copyright (c) 2022 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { PluginBehavior } from '../../mol-plugin/behavior';
import { XTCUploadUI } from './ui';

export const ServerXTCUpload = PluginBehavior.create<{ }>({
    name: 'server-xtc-upload',
    category: 'misc',
    display: {
        name: 'Upload Xtc Stream',
        description: 'Upload XTC file to the trajectory server from an url.'
    },
    ctor: class extends PluginBehavior.Handler<{ }> {
        register(): void {
            this.ctx.customBottomPanels.set('server-xtc-upload', XTCUploadUI as any);
        }

        update() {
            return false;
        }

        unregister() {
            this.ctx.customBottomPanels.delete('server-xtc-upload');
        }
    },
});