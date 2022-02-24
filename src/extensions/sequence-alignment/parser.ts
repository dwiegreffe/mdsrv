/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { ReaderResult as Result } from '../../mol-io/reader/result';
import { Task } from '../../mol-task';

export interface ClustalFile {
    conservation: string,
    sequences: string[],
    chains: string[],
}

async function parse(data: string) {

    const f: ClustalFile = {
        conservation: '',
        sequences: [],
        chains: []
    };

    const lines = data.split('\n');

    // check if clustal file
    const header = lines[0].split(' ')[0].toLowerCase();
    if (header !== 'clustal' && header !== 'clustalw') {
        throw new Error('Wrong file header');
    }

    // empty lines after header
    let lineCount = 1;
    while (lineCount < lines.length && lines[lineCount].length === 0) {
        lineCount++;
    }

    // id, sequence, conservation of current block
    let cId: string[] = [];
    let cSeq: string[] = [];
    let cConservation: string = '';
    // start and end offset of the sequence for the current block
    let start = -1;
    let end = -1;

    // final id, sequence, conservation
    const ids: string[] = [];
    const seq: string[] = [];
    let conservation: string = '';

    while (lineCount < lines.length) {
        const line = lines[lineCount];

        if (line[0] !== ' ' && line.length !== 0 && line.trim()) {
            // line with id and sequence
            const fields = line.replace(/\s+/g, ' ').split(' ');
            if (fields.length < 2 || fields.length > 3) throw Error(`Could not parse line ${lineCount + 1}: \n ${line}`);

            cId.push(fields[0]);
            cSeq.push(fields[1]);

            start = line.indexOf(fields[1]);
            end = start + fields[1].length;

            // with count on end of the line
            if (fields.length === 3) {
                let amount = -1;
                try {
                    amount = parseInt(fields[2]);
                } catch (e) {
                    console.log(e, `Could not parse line ${lineCount + 1}: \n ${line}`);
                }
                const index = ids.indexOf(fields[0]);
                const before = index !== -1 ? seq[index].replace(/-/g, '').length : 0;
                if (amount !== (fields[1].replace(/-/g, '').length + before)) {
                    throw Error(`Could not parse line ${lineCount + 1}: \n ${line}`);
                }
            }
        } else if (line[0] === ' ' || line.length === 0) {
            // empty line or conservation line
            if (start !== -1 && end !== -1) {
                // conservation line
                // if sequences have the same length
                for (const s of cSeq) {
                    if (s.length !== cSeq[0].length) throw Error('Could not parse file');
                }
                // if number of ids matched number of sequences
                if (cId.length !== cSeq.length) throw Error('Could not parse file');

                if (line[0] === ' ') {
                    // conservation line has symbols
                    cConservation = line.substring(start, end);
                    // if conservation line has symbols before or after degree of conservation
                    if (line.substring(0, start).trim() || line.substring(end).trim()) throw Error('Could not parse file');
                    // if conservation line does not have the same length as the sequences
                    if (cConservation.length !== cSeq[0].length) throw Error('Could not parse file');
                } else {
                    // conservation line is empty
                    while (cConservation.length < cSeq[0].length) {
                        cConservation += ' ';
                    }
                }

                if (ids.length !== 0 && seq.length !== 0 && conservation.length !== 0) {
                    // not first block
                    if (ids.length !== cId.length && seq.length !== cSeq.length) throw Error('Could not parse file');
                    for (let i = 0; i < cSeq.length; i++) {
                        seq[i] = seq[i].concat(cSeq[i]);
                    }
                    conservation += cConservation;
                } else if (ids.length === 0 && seq.length === 0 && conservation.length === 0) {
                    // first block
                    for (let i = 0; i < cId.length; i++) {
                        ids.push(cId[i]);
                        seq.push(cSeq[i]);
                    }
                    conservation += cConservation;
                } else {
                    throw Error('Could not parse file');
                }

                // reset all variable for next block
                start = -1;
                end = -1;
                cId = [];
                cSeq = [];
                cConservation = '';
            }
        }

        lineCount++;
    }

    f.conservation = conservation;
    f.chains = ids;
    f.sequences = seq;

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
