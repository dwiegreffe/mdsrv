/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { Task } from '../../mol-task';
import { UUID } from '../../mol-util';
import { ClustalFile } from './parser';

export interface ClustalSequence {
    readonly length: number,
    readonly chain: string,
    readonly sequence: string
}

export { Clustal };

interface Clustal {
    readonly id: UUID

    readonly sequences: ClustalSequence[]
    readonly alignment: ClustalSequence

    readonly amount: number
}

namespace Clustal {
    export function create(sequences: ClustalSequence[], alignment: ClustalSequence): Clustal {
        return {
            id: UUID.create22(),
            sequences,
            alignment,
            amount: sequences.length,
        };
    }
}

export function clustalFromClustal(file: ClustalFile): Task<Clustal> {
    return Task.create('Parse Clustal', async ctx => {
        await ctx.update('Convertring to Clustal');
        const alignment: ClustalSequence = {
            length: file.conservation.length,
            chain: 'alignment',
            sequence: file.conservation
        };
        const sequences: ClustalSequence[] = [];
        for (let i = 0; i < file.sequences.length; i++) {
            const s: ClustalSequence = {
                length: file.sequences[i].length,
                chain: file.chains[i],
                sequence: file.sequences[i]
            };
            sequences.push(s);
        }

        return Clustal.create(sequences, alignment);
    });
}