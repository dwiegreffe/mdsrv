/**
 * Copyright (c) 2020-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 *
 * adapted from /src/servers/plugin-state/config.ts
 */

import * as argparse from 'argparse';

export interface Config {
    working_folder: string,
    port?: string | number,
    api_prefix: string,
}

export function getConfig() {
    const cmdParser = new argparse.ArgumentParser({
        add_help: true
    });
    cmdParser.add_argument('--working-folder', { help: 'Working forlder path.', required: true });
    cmdParser.add_argument('--port', { help: 'Server port. Altenatively use ENV variable PORT.', type: 'int', required: false });
    cmdParser.add_argument('--api-prefix', { help: 'Server API prefix.', default: '', required: false });

    const config = cmdParser.parse_args() as Config;
    if (!config.port) config.port = process.env.port || 1337;
    return config;
}
