/**
 * Copyright (c) 2019-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import * as React from 'react';
import { Canvas3DParams } from '../mol-canvas3d/canvas3d';
import { PluginCommands } from '../mol-plugin/commands';
import { LeftPanelTabName } from '../mol-plugin/layout';
import { StateTransform } from '../mol-state';
import { ParamDefinition as PD } from '../mol-util/param-definition';
import { PluginUIComponent } from './base';
import { IconButton, SectionHeader } from './controls/common';
import { ParameterControls } from './controls/parameters';
import { StateObjectActions } from './state/actions';
import { StateSnapshots } from './state/snapshots';
import { StateTree } from './state/tree';
import { HelpContent } from './viewport/help';
import { HomeOutlinedSvg, AccountTreeOutlinedSvg, TuneSvg, HelpOutlineSvg, SaveOutlinedSvg, DeleteOutlinedSvg, GridViewSvg, FormatListBulletedSvg, BuildSvg } from './controls/icons';
import { RemoteSessionSnapshots } from '../extensions/remote-session/ui';

export class LeftPanelControls extends PluginUIComponent<{}, { tab: LeftPanelTabName }> {
    state = { tab: this.plugin.behaviors.layout.leftPanelTabName.value };

    componentDidMount() {
        this.subscribe(this.plugin.behaviors.layout.leftPanelTabName, tab => {
            if (this.state.tab !== tab) this.setState({ tab });
            if (tab === 'none' && this.plugin.layout.state.regionState.left !== 'collapsed') {
                PluginCommands.Layout.Update(this.plugin, { state: { regionState: { ...this.plugin.layout.state.regionState, left: 'collapsed' } } });
            }
        });

        this.subscribe(this.plugin.state.data.events.changed, ({ state }) => {
            if (this.state.tab !== 'data') return;
            if (state.cells.size === 1) this.set('root');
        });
    }

    set = (tab: LeftPanelTabName) => {
        if (this.state.tab === tab) {
            this.setState({ tab: 'none' }, () => this.plugin.behaviors.layout.leftPanelTabName.next('none'));
            PluginCommands.Layout.Update(this.plugin, { state: { regionState: { ...this.plugin.layout.state.regionState, left: 'collapsed' } } });
            return;
        }

        this.setState({ tab }, () => this.plugin.behaviors.layout.leftPanelTabName.next(tab));
        if (this.plugin.layout.state.regionState.left !== 'full') {
            PluginCommands.Layout.Update(this.plugin, { state: { regionState: { ...this.plugin.layout.state.regionState, left: 'full' } } });
        }
        RemoveAllButton;
    };

    toggle = (panel: string) => {
        switch (panel) {
            case 'extensions': this.plugin.layout.state.regionState.extension === 'full'
                ? PluginCommands.Layout.Update(this.plugin, { state: { regionState: { ...this.plugin.layout.state.regionState, extension: 'hidden' } } })
                : PluginCommands.Layout.Update(this.plugin, { state: { regionState: { ...this.plugin.layout.state.regionState, extension: 'full' } } }); break;
            case 'log': this.plugin.layout.state.regionState.bottom === 'full'
                ? PluginCommands.Layout.Update(this.plugin, { state: { regionState: { ...this.plugin.layout.state.regionState, bottom: 'hidden' } } })
                : PluginCommands.Layout.Update(this.plugin, { state: { regionState: { ...this.plugin.layout.state.regionState, bottom: 'full' } } }); break;
            case 'right': this.plugin.layout.state.regionState.right === 'full'
                ? PluginCommands.Layout.Update(this.plugin, { state: { regionState: { ...this.plugin.layout.state.regionState, right: 'hidden' } } })
                : PluginCommands.Layout.Update(this.plugin, { state: { regionState: { ...this.plugin.layout.state.regionState, right: 'full' } } }); break;
        }
    };

    tabs: { [K in LeftPanelTabName]: JSX.Element } = {
        'none': <></>,
        'root': <>
            <SectionHeader icon={HomeOutlinedSvg} title='Home' toggle={() => this.set('root')} />
            <StateObjectActions state={this.plugin.state.data} nodeRef={StateTransform.RootRef} hideHeader={true} initiallyCollapsed={true} alwaysExpandFirst={false} />
            <RemoteSessionSnapshots listOnly expanded />
            {/* {this.plugin.spec.components?.remoteState !== 'none' && <RemoteStateSnapshots listOnly /> } */}
        </>,
        'data': <>
            <SectionHeader icon={AccountTreeOutlinedSvg} toggle={() => this.set('data')} /* title={<><RemoveAllButton /> State Tree</>}*/
                title='State Tree' />
            <StateTree state={this.plugin.state.data} />
        </>,
        'states': <>
            <SectionHeader icon={SaveOutlinedSvg} title='Plugin Settings' toggle={() => this.set('states')} />
            <StateSnapshots />
        </>,
        'settings': <>
            <SectionHeader icon={TuneSvg} title='Plugin Settings' toggle={() => this.set('settings')} />
            <FullSettings />
        </>,
        'help': <>
            <SectionHeader icon={HelpOutlineSvg} title='Help' toggle={() => this.set('help')} />
            <HelpContent />
        </>
    };

    render() {
        const tab = this.state.tab;

        return <div className='msp-left-panel-controls'>
            <div className='msp-left-panel-controls-buttons'>
                <IconButton svg={HomeOutlinedSvg} toggleState={tab === 'root'} transparent onClick={() => this.set('root')} title='Home' />
                <DataIcon set={this.set} />
                <IconButton svg={SaveOutlinedSvg} toggleState={tab === 'states'} transparent onClick={() => this.set('states')} title='Plugin State' />
                <IconButton svg={HelpOutlineSvg} toggleState={tab === 'help'} transparent onClick={() => this.set('help')} title='Help' />
                <IconButton svg={FormatListBulletedSvg} toggleState={this.plugin.layout.state.regionState.bottom === 'full'} onClick={() => this.toggle('log')} title={this.plugin.layout.state.regionState.bottom === 'full' ? 'Hide Log' : 'Expand Log'}/>
                <IconButton svg={GridViewSvg} toggleState={this.plugin.layout.state.regionState.extension === 'full'} onClick={() => this.toggle('extensions')} title={this.plugin.layout.state.regionState.extension === 'hidden' ? 'Expand Extensions' : 'Hide Extensions'} />
                {window.matchMedia('(orientation: landscape)').matches ? <IconButton svg={BuildSvg} toggleState={this.plugin.layout.state.regionState.right === 'full'} onClick={() => this.toggle('right')} title={this.plugin.layout.state.regionState.right === 'hidden' ? 'Expand Structure Tools' : 'Hide Structure Tools'} /> : null}
                <div className='msp-left-panel-controls-buttons-bottom'>
                    <IconButton svg={TuneSvg} toggleState={tab === 'settings'} transparent onClick={() => this.set('settings')} title='Settings' />
                </div>
            </div>
            <div className='msp-scrollable-container'>
                {this.tabs[tab]}
            </div>
        </div>;
    }
}

class DataIcon extends PluginUIComponent<{ set: (tab: LeftPanelTabName) => void }, { changed: boolean }> {
    state = { changed: false };

    get tab() {
        return this.plugin.behaviors.layout.leftPanelTabName.value;
    }

    componentDidMount() {
        this.subscribe(this.plugin.behaviors.layout.leftPanelTabName, tab => {
            if (this.tab === 'data') this.setState({ changed: false });
            else this.forceUpdate();
        });

        this.subscribe(this.plugin.state.data.events.changed, state => {
            if (this.tab !== 'data') this.setState({ changed: true });
        });
    }

    render() {
        return <IconButton
            svg={AccountTreeOutlinedSvg} toggleState={this.tab === 'data'} transparent onClick={() => this.props.set('data')} title='State Tree'
            style={{ position: 'relative' }} extraContent={this.state.changed ? <div className='msp-left-panel-controls-button-data-dirty' /> : void 0} />;
    }
}

class FullSettings extends PluginUIComponent {
    private setSettings = (p: { param: PD.Base<any>, name: string, value: any }) => {
        PluginCommands.Canvas3D.SetSettings(this.plugin, { settings: { [p.name]: p.value } });
    };

    componentDidMount() {
        this.subscribe(this.plugin.events.canvas3d.settingsUpdated, () => this.forceUpdate());
        this.subscribe(this.plugin.layout.events.updated, () => this.forceUpdate());

        this.subscribe(this.plugin.canvas3d!.camera.stateChanged, state => {
            if (state.radiusMax !== undefined || state.radius !== undefined) {
                this.forceUpdate();
            }
        });
    }

    render() {
        return <>
            {this.plugin.canvas3d && <>
                <SectionHeader title='Viewport' />
                <ParameterControls params={Canvas3DParams} values={this.plugin.canvas3d.props} onChange={this.setSettings} />
            </>}
            <SectionHeader title='Behavior' />
            <StateTree state={this.plugin.state.behaviors} />
        </>;
    }
}

class RemoveAllButton extends PluginUIComponent<{ }> {
    componentDidMount() {
        this.subscribe(this.plugin.state.events.cell.created, e => {
            if (e.cell.transform.parent === StateTransform.RootRef) this.forceUpdate();
        });

        this.subscribe(this.plugin.state.events.cell.removed, e => {
            if (e.parent === StateTransform.RootRef) this.forceUpdate();
        });
    }

    remove = (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();
        PluginCommands.State.RemoveObject(this.plugin, { state: this.plugin.state.data, ref: StateTransform.RootRef });
    };

    render() {
        const count = this.plugin.state.data.tree.children.get(StateTransform.RootRef).size;
        if (count === 0) return null;
        return <IconButton svg={DeleteOutlinedSvg} onClick={this.remove} title={'Remove All'} style={{ display: 'inline-block' }} small className='msp-no-hover-outline' transparent />;
    }
}
