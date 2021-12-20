/**
 * Copyright (c) 2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import * as ReactDOM from 'react-dom';
import { AlphaOrbitalsExample } from '.';
import { ParameterControls } from '../../mol-plugin-ui/controls/parameters';
import { useBehavior } from '../../mol-plugin-ui/hooks/use-behavior';
import { PluginContextContainer } from '../../mol-plugin-ui/plugin';

export function mountControls(orbitals: AlphaOrbitalsExample, parent: Element) {
    ReactDOM.render(<PluginContextContainer plugin={orbitals.plugin}>
        <Controls orbitals={orbitals} />
    </PluginContextContainer>, parent);
}

function Controls({ orbitals }: { orbitals: AlphaOrbitalsExample }) {
    const params = useBehavior(orbitals.params);
    const values = useBehavior(orbitals.state);

    return <ParameterControls params={params as any} values={values} onChangeValues={(vs: any) => orbitals.state.next(vs)} />;
}