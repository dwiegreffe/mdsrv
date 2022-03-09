/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { PluginStateObject } from '../../mol-plugin-state/objects';
import { StateTransforms } from '../../mol-plugin-state/transforms';
import { TrajectoryXTCFromModelAndServer } from '../../mol-plugin-state/transforms/model';
import { CollapsableControls, PurePluginUIComponent } from '../../mol-plugin-ui/base';
import { Button, IconButton } from '../../mol-plugin-ui/controls/common';
import { CheckSvg, RefreshSvg, ShowChart } from '../../mol-plugin-ui/controls/icons';
import { SelectControl, TextControl } from '../../mol-plugin-ui/controls/parameters';
import { Task } from '../../mol-task';
import { ParamDefinition as PD } from '../../mol-util/param-definition';
import { RemoteEntry } from '../../mol-plugin-ui/state/snapshots';
import { urlCombine } from '../../mol-util/url';
import { OrderedMap } from 'immutable';
import { DefaultSessionServerURL } from '../remote-session/controls';

require('./xtc-stream.scss');

export const DefaultTrajectoryServerUrl = DefaultSessionServerURL;

export class XTCStreamTrajectory extends CollapsableControls {
    defaultState() {
        return {
            isCollapsed: true,
            header: 'Match Stream Trajectory',
            brand: { accent: 'gray' as const, svg: ShowChart },
            isHidden: false,
            hoverInfo: 'Add a trajectory from a remote server to a structure'
        };
    }

    renderControls() {
        return <>
            <XTCStreamControls />
        </>;
    }
}

type XTCStreamControlsState = {
    isBusy: boolean,
    modelRef: string,
    url: string,
    trajectoryId: string,
    entries: OrderedMap<string, RemoteEntry>,
}

type XTCStreamControlProps = {

}

export class XTCStreamControls extends PurePluginUIComponent<XTCStreamControlProps, XTCStreamControlsState> {
    state: XTCStreamControlsState = {
        isBusy: false,
        modelRef: '',
        url: DefaultTrajectoryServerUrl,
        trajectoryId: '',
        entries: OrderedMap(),
    };

    componentDidMount() {
        this.subscribe(this.plugin.state.events.object.created, ({ obj }) => this.sync());
        this.subscribe(this.plugin.state.events.object.removed, ({ obj }) => this.sync());
        this.refresh();
    }

    sync() {
        const modelOptions = this.modelOptions;
        const trajectoryOptions = this.trajectoryOptions;
        this.setState({
            modelRef: modelOptions[0][0],
            trajectoryId: trajectoryOptions[0][0],
        });
    }

    get modelOptions() {
        const models = [
            ...this.plugin.state.data.selectQ(q => q.rootsOfType(PluginStateObject.Molecule.Model)),
            ...this.plugin.state.data.selectQ(q => q.rootsOfType(PluginStateObject.Molecule.Topology))
        ];
        const options = models.map(m => [m.transform.ref, m.obj!.label]) as [string, string][];
        if (options.length === 0) options.push(['', 'No models']);
        return options;
    }

    get trajectoryOptions() {
        const options: [string, string][] = [];
        this.state.entries.forEach((v, k) => {
            options.push([k, v?.name] as [string, string]);
        });
        if (options.length === 0) options.push(['', 'No trajectories']);
        return options;
    }

    get param() {
        const modelOptions = this.modelOptions;
        const trajectoryOptions = this.trajectoryOptions;
        return {
            model: PD.Select(modelOptions[0][0], modelOptions),
            url: PD.Text(this.state.url, { label: 'Server Url' }),
            trajectory: PD.Select(trajectoryOptions[0][0], trajectoryOptions),
        };
    }

    get value() {
        return {
            model: this.state.modelRef,
            url: this.state.url,
            trajectory: this.state.trajectoryId,
        };
    }

    canApply() {
        const state = this.state;
        if (state.modelRef === '' || state.trajectoryId === '' || state.entries.size === 0) {
            return false;
        }
        return true;
    }

    private onControlChanged = (p: {param: PD.Base<any>, name: string, value: any}) => {
        const state = { ...this.state };
        switch (p.name) {
            case 'model':
                state.modelRef = p.value;
                break;
            case 'url':
                state.url = p.value;
                break;
            case 'trajectory':
                state.trajectoryId = p.value;
                break;
        }
        this.setState(state);
    };

    serverUrl(q?: string) {
        if (!q) return this.state.url;
        return urlCombine(this.state.url, q);
    }

    refresh = async () => {
        try {
            this.setState({ isBusy: true });
            const list = (await this.plugin.runTask<RemoteEntry[]>(this.plugin.fetch({ url: this.serverUrl('list/trajectory'), type: 'json' }))) || [];

            list.sort((a, b) => {
                if (a.isSticky === b.isSticky) return a.timestamp - b.timestamp;
                return a.isSticky ? -1 : 1;
            });

            const entries = OrderedMap<string, RemoteEntry>().asMutable();
            for (const e of list) {
                entries.set(e.id, {
                    ...e,
                    url: this.serverUrl(`get/trajectory/${e.id}`),
                    removeUrl: this.serverUrl(`remove/trajectory/${e.id}`)
                });
            }
            this.setState({ entries: entries.asImmutable(), isBusy: false });
        } catch (e) {
            this.plugin.log.error('Fetching Trajectory: ' + e);
            this.setState({ entries: OrderedMap(), isBusy: false });
        }
        this.sync();
    };

    addStreamTrajectory = (entry: RemoteEntry) => {
        return Task.create('Add Trajectory Stream', async taskCtx => {
            const state = this.plugin.state.data;
            const dependsOn = [this.state.modelRef];
            const model = state.build().toRoot()
                .apply(TrajectoryXTCFromModelAndServer, {
                    modelRef: this.state.modelRef,
                    trajectoryUrl: entry.url
                }, { dependsOn })
                .apply(StateTransforms.Model.ModelFromTrajectory, { modelIndex: 0 });

            await state.updateTree(model).runInContext(taskCtx);
            const structure = await this.plugin.builders.structure.createStructure(model.selector);
            await this.plugin.builders.structure.representation.applyPreset(structure, 'auto');
        });
    };

    apply = async () => {
        const entry = this.state.entries.get(this.state.trajectoryId);
        if (!entry) {
            this.plugin.log.error('Error, trajectory could not be matched');
        } else {
            this.plugin.runTask(this.addStreamTrajectory(entry));
        }
    };

    render() {
        const canApply = this.canApply();

        const param = this.param;
        const value = this.value;

        return <>
            <SelectControl param={param.model} name='model' value={value.model} onChange={(e) => { this.onControlChanged(e); }} />
            <div className='msp-url-refresh-wrap'>
                <div className='msp-url-refresh-wider'>
                    <TextControl param={param.url} name='url' value={value.url} onChange={(e) => { this.onControlChanged(e); }} />
                </div>
                <IconButton svg={RefreshSvg} className='msp-url-refresh-btn' onClick={this.refresh} />
            </div>
            <SelectControl param={param.trajectory} name='trajectory' value={value.trajectory} onChange={(e) => { this.onControlChanged(e); }} />
            <Button icon={canApply ? CheckSvg : void 0} className={`msp-btn-commit msp-btn-commit-${canApply ? 'on' : 'off'}`} onClick={this.apply} disabled={!canApply} style={{ marginTop: 1 }}>
                Add Xtc Stream Trajectory
            </Button>
        </>;
    }
}
