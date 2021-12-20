/**
 * Copyright (c) 2018-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 * 
 * adapted from /src/mol-plugin-ui/state/snapshots.tsx
 */

import { OrderedMap } from 'immutable';
import { RemoteEntry, RemoteStateSnapshotList } from '../../mol-plugin-ui/state/snapshots';
import { urlCombine } from '../../mol-util/url';
import { ParameterControls } from '../../mol-plugin-ui/controls/parameters';
import { Button, IconButton } from '../../mol-plugin-ui/controls/common';
import { RefreshSvg, CloudUploadSvg, SaveOutlinedSvg } from '../../mol-plugin-ui/controls/icons';
import { CollapsableControls, CollapsableState } from '../../mol-plugin-ui/base';
import { RemoteSessionControls, RemoteSessionParams } from './controls';
import { merge } from 'rxjs';
import { HelpGroup, HelpText } from '../../mol-plugin-ui/viewport/help';

interface State {
    busy?: boolean,
    entries?: OrderedMap<string, RemoteEntry>,
}

export class RemoteSessionSnapshots extends CollapsableControls<{ listOnly?: boolean, expanded?: boolean }, State> {
    private _controls: RemoteSessionControls | undefined;

    get controls() {
        return this._controls || (this._controls = new RemoteSessionControls(this.plugin));
    }

    protected defaultState(): State & CollapsableState {
        const expanded = this.props.expanded ? this.props.expanded : false;
        return {
            header: 'Remote Session',
            isCollapsed: !expanded,
            brand: { accent: 'cyan', svg: SaveOutlinedSvg },
            isHidden: false,
            hoverInfo: 'Load/save a whole session (including locally imported files) from/to a remote session server'
        };
    }

    protected renderControls(): JSX.Element {
        const ctrl = this.controls;
        return <>
            {!this.props.listOnly && <>
                <ParameterControls
                    params={RemoteSessionParams}
                    values={ctrl.behaviors.params.value}
                    onChangeValues={xs => ctrl.behaviors.params.next(xs)}
                    isDisabled={this.state.busy}
                />
                <HelpGroup header='Session Info'>
                    <HelpText>Saving a whole session to a remote session server will not only save he state of the client,
                        but will also serialize the data imported into the session.
                        This ensures that the data used can be reloaded unchanged into the client at a later time.
                    </HelpText>
                </HelpGroup>
                <div className='msp-flex-row'>
                    <IconButton onClick={this.refresh} disabled={this.state.busy} svg={RefreshSvg} />
                    <Button icon={CloudUploadSvg} onClick={this.upload} disabled={this.state.busy} commit>Upload</Button>
                </div>
            </>}
            {this.state.entries && <>
                <RemoteStateSnapshotList
                    entries={this.state.entries}
                    isBusy={this.state.busy || false}
                    serverUrl={this.controls.behaviors.params.value.options.serverURL}
                    open={'session-url'}
                    fetch={this.fetch}
                    remove={this.remove}
                />
            </>}
        </>;
    }

    componentDidMount() {
        const merged = merge(
            this.controls.behaviors.params,
        );

        this.subscribe(merged, () => {
            this.refresh();
            this.forceUpdate();
        });

        this.refresh();
    }

    componentWillUnmount() {
        this._controls?.dispose();
        this._controls = void 0;
    }

    serverUrl(q?: string) {
        if (!q) return this.controls.behaviors.params.value.options.serverURL;
        return urlCombine(this.controls.behaviors.params.value.options.serverURL, q);
    }

    refresh = async () => {
        try {
            this.setState({ busy: true });
            const list = (await this.plugin.runTask<RemoteEntry[]>(this.plugin.fetch({ url: this.serverUrl('list/session'), type: 'json' }))) || [];
            list.sort((a, b) => {
                if (a.isSticky === b.isSticky) return a.timestamp - b.timestamp;
                return a.isSticky ? -1 : 1;
            });

            const entries = OrderedMap<string, RemoteEntry>().asMutable();
            for (const e of list) {
                entries.set(e.id, {
                    ...e,
                    url: this.serverUrl(`get/session/${e.id}`),
                    removeUrl: this.serverUrl(`remove/session/${e.id}`)
                });
            }

            this.setState({ entries: entries.asImmutable(), busy: false });
        } catch (e) {
            this.plugin.log.error('Fetching Remote Snapshots: ' + e);
            this.setState({ entries: OrderedMap(), busy: false });
        }
    };

    upload = async () => {
        try {
            this.setState({ busy: true });
            await this.controls.upload();
            this.plugin.log.message('Snapshot uploaded.');
            this.setState({ busy: false });
            this.refresh();
        } finally {
            this.setState({ busy: false });
        }
    };

    fetch = async (e: React.MouseEvent<HTMLElement>) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (!id) return;
        const entry = this.state.entries!.get(id);
        if (!entry) return;

        try {
            this.setState({ busy: true });
            await this.controls.fetch(entry.url);
        } finally {
            this.setState({ busy: false });
        }
    };

    remove = async (e: React.MouseEvent<HTMLElement>) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (!id) return;
        const entry = this.state.entries!.get(id);
        if (!entry) return;
        this.setState({ entries: this.state.entries!.remove(id) });

        try {
            await fetch(entry.removeUrl);
        } catch { }
    };
}