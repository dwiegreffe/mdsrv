/**
 * Copyright (c) 2022 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { PluginComponent } from '../../mol-plugin-state/component';
import { PluginContext } from '../../mol-plugin/context';
import { ParamDefinition as PD } from '../../mol-util/param-definition';
import { urlCombine } from '../../mol-util/url';
import { DefaultTrajectoryServerUrl } from '../xtc-stream/trajectory';

export const UploadParams = {
    server: PD.Text(DefaultTrajectoryServerUrl),
    url: PD.Text(),
    name: PD.Text(),
    description: PD.Text()
};

export class XTCUploadControls extends PluginComponent {
    readonly behaviors = {
        params: this.ev.behavior<PD.Values<typeof UploadParams>>(PD.getDefaultValues(UploadParams))
    };

    upload = async () => {
        const params = this.behaviors.params.value;

        if (params.url.match(/(\w*)\.xtc$/) === null) {
            this.plugin.log.error('URL ist not an .xtc');
            return;
        }

        const url = urlCombine(params.server, `/upload/trajectory/${encodeURIComponent(params.url)}/${encodeURIComponent(params.name)}/${encodeURIComponent(params.description)}`);
        const message = await this.plugin.runTask(this.plugin.fetch({ url, type: 'string' }));
        this.plugin.log.message(message);
    };

    constructor(private plugin: PluginContext) {
        super();
    }
}