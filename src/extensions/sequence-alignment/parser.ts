/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { ReaderResult as Result } from '../../mol-io/reader/result';
import { Task } from '../../mol-task';

export interface ClustalFile {
    alignment: string,
    sequences: string[],
    chains: string[],
}

async function parse(data: string) {

    const f: ClustalFile = {
        alignment: '',
        sequences: [],
        chains: []
    };

    const lines = data.split('\n');

    // check if clustal file
    if (lines[0].split(' ')[0].toLowerCase() !== ('clustal' || 'clustalw')) return f;

    let count = 1;
    let block: string[] = [];
    let firstBlock = true;

    while (count < lines.length) {
        // empty line
        if (lines[count].length === 0) {
            // lines before not empty
            if (block.length > 0) {
                let last = 0;
                for (let i = 0; i < block.length; i++) {
                    // alignment line
                    if (i === block.length - 1) {
                        const alignment = block[i].slice(-last);
                        if (firstBlock) {
                            f.alignment = f.alignment.concat(alignment);
                        } else {
                            f.alignment = f.alignment.concat(alignment);
                        }
                    } else {
                        const line = block[i].replace(/\s+/g, ' ').split(' ');
                        last = line[1].length;
                        if (firstBlock) {
                            f.chains.push(line[0]);
                            f.sequences.push(line[1]);
                        } else {
                            f.sequences[i] = f.sequences[i].concat(line[1]);
                        }
                    }
                }
                block = [];
                if (firstBlock) {
                    firstBlock = false;
                }
            }
        } else {
            // not empty line
            block.push(lines[count]);
        }
        count++;
    }

    return f;
}

export function parseClustal(data: string) {
    return Task.create<Result<ClustalFile>>('Parse Clustal', async ctx => {
        try {
            ctx.update({ canAbort: true, message: 'Parsing alignment...' });
            const file = await parse(data);
            return Result.success(file);
        } catch (e) {
            return Result.error('' + e);
        }
    });
}
