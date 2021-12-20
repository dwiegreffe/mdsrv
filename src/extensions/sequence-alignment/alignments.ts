/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 */

import { Structure } from '../../mol-model/structure';
import { StructureSelectionManager } from '../../mol-plugin-state/manager/structure/selection';
import { getSequenceWrapper } from '../../mol-plugin-ui/sequence';
import { SequenceWrapper } from '../../mol-plugin-ui/sequence/wrapper';
import { UUID } from '../../mol-util';
import { Clustal } from './clustal';

export type AlignmentWrapper = {
    // wrapper
    wrapper: (string|SequenceWrapper.Any),
    // chain label from clustal file
    chainLabel: string,
    // label which structure the alignment sequence is matched to
    wrapperLabel: string,
    // sequence with gaps
    alignmentSequence: string,
    // start index of substring in wrapper
    startIndex: number,
    structureRef: string
}

export { Alignment };

interface Alignment {
    readonly id: UUID
    readonly label: string

    readonly wrapper: AlignmentWrapper[]
    readonly alignment: string
}

namespace Alignment {
    export function create(wrapper: AlignmentWrapper[], structures: Structure[], clustal: Clustal, label: string): Alignment {
        return {
            id: UUID.create22(),
            label,
            wrapper,
            alignment: clustal.alignment.sequence
        };
    }

    export function getAlignmentWraper(match: (string|number)[][], structures: Structure[], selection: StructureSelectionManager): AlignmentWrapper[] {
        const wrapper: AlignmentWrapper[] = [];
        for (let i = 0; i < match.length; i++) {
            const w = getSequenceWrapper({
                structure: structures[i],
                modelEntityId: match[i][5] as string,
                chainGroupId: match[i][6] as number,
                operatorKey: match[i][7] as string,
            }, selection);

            const a: AlignmentWrapper = {
                wrapper: w,
                chainLabel: match[i][0] as string,
                wrapperLabel: match[i][1] as string,
                alignmentSequence: match[i][2] as string,
                startIndex: match[i][3] as number,
                structureRef: match[i][4] as string
            };

            wrapper.push(a);
        }
        return wrapper;
    }
}

export function getAlignment(match: (string|number)[][], structures: Structure[], clustal: Clustal, label: string, selection: StructureSelectionManager) {
    const wrapper = Alignment.getAlignmentWraper(match, structures, selection);
    return Alignment.create(wrapper, structures, clustal, label);
}
