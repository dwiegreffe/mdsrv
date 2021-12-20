/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { PluginBehavior } from '../../mol-plugin/behavior';
import { MeasurementLinePlotUI } from './ui';

export const MeasurementPlot = PluginBehavior.create<{ }>({
    name: 'extension-measurement-plot',
    category: 'misc',
    display: {
        name: 'Plot Measurement'
    },
    ctor: class extends PluginBehavior.Handler<{ }> {
        register(): void {
            this.ctx.customBottomPanels.set('measurement-line-plot', MeasurementLinePlotUI as any);
        }

        update() {
            return false;
        }

        unregister() {
            this.ctx.customBottomPanels.delete('measurement-line-plot');
        }
    },
    params: () => ({ })
});