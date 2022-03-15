/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { PluginComponent } from '../../mol-plugin-state/component';
import { PluginCommands } from '../../mol-plugin/commands';
import { PluginContext } from '../../mol-plugin/context';
import { ParamDefinition as PD } from '../../mol-util/param-definition';

export const DefaultSessionServerURL = 'https://remote.sca-ds.de';

export const RemoteSessionParams = {
    name: PD.Text(),
    options: PD.Group({
        description: PD.Text(),
        playOnLoad: PD.Boolean(false),
        serverURL: PD.Text(DefaultSessionServerURL)
    })
};

export class RemoteSessionControls extends PluginComponent {
    readonly behaviors = {
        params: this.ev.behavior<PD.Values<typeof RemoteSessionParams>>(PD.getDefaultValues(RemoteSessionParams))
    };

    upload = async () => {
        await PluginCommands.State.Snapshots.UploadSession(this.plugin, {
            name: this.behaviors.params.value.name,
            description: this.behaviors.params.value.options.description,
            serverUrl: this.behaviors.params.value.options.serverURL,
            type: 'molx'
        });
    };

    fetch = async (url: string) => {
        await PluginCommands.State.Snapshots.FetchSession(this.plugin, { url });
    };

    constructor(private plugin: PluginContext) {
        super();
    }
}