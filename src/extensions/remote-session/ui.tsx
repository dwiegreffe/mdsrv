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
import { Button } from '../../mol-plugin-ui/controls/common';
import { RefreshSvg, CloudUploadSvg, SaveOutlinedSvg } from '../../mol-plugin-ui/controls/icons';
import { CollapsableControls, CollapsableState } from '../../mol-plugin-ui/base';
import { RemoteSessionControls, RemoteSessionParams, ServerParam } from './controls';
import { HelpGroup, HelpText } from '../../mol-plugin-ui/viewport/help';
import { sleep } from '../../mol-util/sleep';

type SessionDetails = {
    name: string,
    description: string,
    source: string | undefined
}

interface State {
    busy?: boolean,
    entries?: OrderedMap<string, RemoteEntry>,
    sessionDetails?: SessionDetails,
    successful?: boolean | undefined,
}

export class RemoteSessionSnapshots extends CollapsableControls<{ listOnly?: boolean, expanded?: boolean }, State> {
    private _controls: RemoteSessionControls | undefined;

    private uploadMessage: React.CSSProperties = {
        textAlign: 'center',
        color: '#68BEFD',
        fontWeight: 'bold',
    };

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
            hoverInfo: 'Load/save a whole session (including locally imported files) from/to a remote session server',
            sessionDetails: undefined,
        };
    }

    private renderSessionInfo(session: SessionDetails) {
        return <div style={{ marginBottom: 10, marginTop: 5 }}>
            <div className='msp-help-text'>
                <div><b><i>Current Session:</i></b></div>
                <div>Name: <i>{`${session.name}`}</i></div>
                {session.description.length !== 0 ? <div>Description: <i>{`${session.description}`}</i></div> : null}
                {session.source ? <div>Source: <i>{`${session.source}`}</i></div> : null}
            </div>
        </div>;
    }

    protected renderControls(): JSX.Element {
        const ctrl = this.controls;
        return <>
            {!this.props.listOnly && <>
                <ParameterControls
                    params={ServerParam}
                    values={ctrl.behaviors.serverUrl.value}
                    onChangeValues={xs => ctrl.behaviors.serverUrl.next(xs)}
                    isDisabled={this.state.busy}
                />
                <ParameterControls
                    params={RemoteSessionParams}
                    values={ctrl.behaviors.params.value}
                    onChangeValues={xs => ctrl.behaviors.params.next(xs)}
                    isDisabled={this.state.busy}
                />
                <div className='msp-flex-row'>
                    {this.state.successful !== undefined && <p className='msp-label-empty' style={this.uploadMessage}>{this.state.successful ? 'Upload successful' : 'Upload error'}</p>}
                    <Button icon={CloudUploadSvg} onClick={this.upload} disabled={this.state.busy} commit>Upload</Button>
                </div>
                <HelpGroup header='Session Info'>
                    <HelpText>Saving a whole session to a remote session server will not only save he state of the client,
                    but will also serialize the data imported into the session.
                    This ensures that the data used can be reloaded unchanged into the client at a later time.
                    To further define your session, you can provide a name, a detailed despription, and the origin of the data in the session.
                    </HelpText>
                </HelpGroup>
            </>}
            {this.props.listOnly && this.state.entries && this.state.sessionDetails ? this.renderSessionInfo(this.state.sessionDetails) : null}
            {this.props.listOnly && this.state.entries && <div>
                <ParameterControls
                    params={ServerParam}
                    values={ctrl.behaviors.serverUrl.value}
                    onChangeValues={xs => ctrl.behaviors.serverUrl.next(xs)}
                    isDisabled={this.state.busy}
                />
                <div className='msp-flex-row'>
                    <Button onClick={this.refresh} disabled={this.state.busy} icon={RefreshSvg}>Refresh</Button>
                </div>
                <RemoteStateSnapshotList
                    entries={this.state.entries}
                    isBusy={this.state.busy || false}
                    serverUrl={this.controls.behaviors.serverUrl.value.serverURL}
                    open={'session-url'}
                    fetch={this.fetch}
                    remove={this.remove}
                />
            </div>}
        </>;
    }

    componentDidMount() {
        this.subscribe(this.controls.behaviors.params, () => {
            this.forceUpdate();
        });

        this.subscribe(this.controls.behaviors.serverUrl, () => {
            this.forceUpdate();
        });

        this.refresh();
    }

    componentWillUnmount() {
        this._controls?.dispose();
        this._controls = void 0;
    }

    serverUrl(q?: string) {
        if (!q) return this.controls.behaviors.serverUrl.value.serverURL;
        return urlCombine(this.controls.behaviors.serverUrl.value.serverURL, q);
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
            this.plugin.log.error('Error Fetching Remote Snapshots: ' + e);
            this.setState({ entries: OrderedMap(), busy: false });
        }
    };

    upload = async () => {
        try {
            this.setState({ busy: true });
            await this.controls.upload();
            this.plugin.log.message('Snapshot uploaded.');
            this.setState({ busy: false, successful: true });
            this.refresh();
            await sleep(5000);
            this.setState({ successful: undefined });
        } catch (e) {
            this.plugin.log.error('Something went wrong. The session was not uploaded to the server. Please check the Server URL.');
            this.setState({ successful: false });
            await sleep(5000);
            this.setState({ successful: undefined });
        } finally {
            this.setState({ busy: false });
        }
    };

    fetch = async (e: React.MouseEvent<HTMLElement>) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (!id) return;
        const entry = this.state.entries!.get(id);
        if (!entry) return;

        const info: SessionDetails = {
            name: entry.name,
            description: entry.description,
            source: entry.source
        };

        try {
            this.setState({ busy: true });
            await this.controls.fetch(entry.url);
            this.setState({ sessionDetails: info });
        } catch {
            this.setState({ sessionDetails: undefined });
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