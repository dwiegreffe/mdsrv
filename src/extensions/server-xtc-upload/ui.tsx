/**
 * Copyright (c) 2022 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { CollapsableControls } from '../../mol-plugin-ui/base';
import { Button } from '../../mol-plugin-ui/controls/common';
import { CloudUploadSvg, ShowChart } from '../../mol-plugin-ui/controls/icons';
import { ParameterControls } from '../../mol-plugin-ui/controls/parameters';
import { UploadParams, XTCUploadControls } from './controls';

interface State {
    busy?: boolean,
}

export class XTCUploadUI extends CollapsableControls<{}, State> {
    private _controls: XTCUploadControls | undefined;

    get controls() {
        return this._controls || (this._controls = new XTCUploadControls(this.plugin));
    }

    protected defaultState() {
        return {
            isCollapsed: true,
            header: 'Add Trajectory to Stream Server',
            brand: { accent: 'gray' as const, svg: ShowChart },
            isHidden: false,
            hoverInfo: ''
        };
    }

    protected renderControls(): JSX.Element {
        const ctrl = this.controls;
        const params = ctrl.behaviors.params.value;
        const complete = (params.name === '' || params.description === '' || params.url === '') ? true : false;

        return <>
            <ParameterControls
                params={UploadParams}
                values={params}
                onChangeValues={xs => ctrl.behaviors.params.next(xs)}
                isDisabled={this.state.busy}
            />
            <div className="msp-flex-row">
                <Button icon={CloudUploadSvg} onClick={this.upload} disabled={this.state.busy || complete} commit>
                    Upload Trajectory to Server
                </Button>
            </div>
        </>;
    }

    componentDidMount() {
        this.subscribe(this.controls.behaviors.params, () => {
            if (!this.state.isCollapsed) this.forceUpdate();
        });
    }

    componentWillUnmount() {
        this._controls?.dispose();
        this._controls = void 0;
    }

    upload = async () => {
        try {
            this.setState({ busy: true });
            await this.controls.upload();
            this.setState({ busy: false });
        } finally {
            this.setState({ busy: false });
        }
    };

}