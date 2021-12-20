#!/usr/bin/env node
/**
 * Copyright (c) 2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Josh McMenemy <josh.mcmenemy@gmail.com>
 */

import * as argparse from 'argparse';
import * as path from 'path';
import util from 'util';
import fs from 'fs';
require('util.promisify').shim();
const writeFile = util.promisify(fs.writeFile);

import { DatabaseCollection } from '../../mol-data/db';
import { CCD_Schema } from '../../mol-io/reader/cif/schema/ccd';
import { ensureDataAvailable, readCCD } from './util';

function extractIonNames(ccd: DatabaseCollection<CCD_Schema>) {
    const ionNames: string[] = [];
    for (const k in ccd) {
        const { chem_comp } = ccd[k];
        if (chem_comp.name.value(0).toUpperCase().includes(' ION')) {
            ionNames.push(chem_comp.id.value(0));
        }
    }
    // these are extra ions that don't have ION in their name
    ionNames.push('NCO', 'OHX');
    return ionNames;
}

function writeIonNamesFile(filePath: string, ionNames: string[]) {
    const output = `/**
 * Copyright (c) 2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * Code-generated ion names params file. Names extracted from CCD components.
 *
 * @author molstar/chem-comp-dict/create-table cli
 */

export const IonNames = new Set(${JSON.stringify(ionNames).replace(/"/g, "'").replace(/,/g, ', ')});
`;
    writeFile(filePath, output);
}

async function run(out: string, forceDownload = false) {
    await ensureDataAvailable(forceDownload);
    const ccd = await readCCD();
    const ionNames = extractIonNames(ccd);
    if (!fs.existsSync(path.dirname(out))) {
        fs.mkdirSync(path.dirname(out));
    }
    writeIonNamesFile(out, ionNames);
}

const parser = new argparse.ArgumentParser({
    add_help: true,
    description: 'Extract and save IonNames from CCD.'
});
parser.add_argument('out', {
    help: 'Generated file output path.'
});
parser.add_argument('--forceDownload', '-f', {
    action: 'store_true',
    help: 'Force download of CCD and PVCD.'
});
interface Args {
    out: string,
    forceDownload?: boolean,
}
const args: Args = parser.parse_args();

run(args.out, args.forceDownload);
