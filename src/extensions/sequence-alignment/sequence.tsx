/**
 * Copyright (c) 2018-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 * 
 * adapted from /src/mol-plugin-ui/sequence/sequence.tsx
 */

import { Sequence } from '../../mol-plugin-ui/sequence/sequence';
import { SequenceWrapper } from '../../mol-plugin-ui/sequence/wrapper';

type SequenceProps = {
    sequenceWrapper: SequenceWrapper.Any,
    sequenceAlignment: string,
    index: number
}

export class AlignmentSequence<P extends SequenceProps> extends Sequence<P> {

    componentDidMount() {
        super.componentDidMount();
    }

    componentWillUnmount() {
        super.componentWillUnmount();
    }

    protected residueAlign(idx: number, seqIdx: number, label: string, marker: number) {
        return <span key={idx} data-seqid={seqIdx} style={{ backgroundColor: this.getBackgroundColor(marker) }} className={this.getResidueClass(seqIdx, label)}>{`\u200b${label}\u200b`}</span>;
    }

    private getSequenceGapSpan(seqIdx: number) {
        return <span key={`gap-${seqIdx}`}>{`\u200b\u002d\u200b`}</span>;
    }

    protected updateMarker() {
        if (!this.parentDiv.current) return;
        const xs = this.parentDiv.current.children;
        const { markerArray } = this.props.sequenceWrapper;

        let j = 0;
        for (let i = 0; i < this.props.sequenceAlignment.length; i++) {
            const span = xs[i] as HTMLSpanElement;
            if (!span) return;

            if (this.props.sequenceAlignment.charAt(i) !== '-') {
                const backgroundColor = this.getBackgroundColor(markerArray[j]);
                if (span.style.backgroundColor !== backgroundColor) span.style.backgroundColor = backgroundColor;
                j++;
            }
        }
    }

    render() {
        const sw = this.props.sequenceWrapper;

        const elems: JSX.Element[] = [];

        let j = this.props.index;
        for (let i = 0; i < this.props.sequenceAlignment.length; i++) {
            const label = this.props.sequenceAlignment.charAt(i);
            if (label === '-') {
                elems[elems.length] = this.getSequenceGapSpan(i);
            } else {
                elems[elems.length] = this.residueAlign(i, j, label, sw.markerArray[j]);
                j++;
            }
        }

        // calling .updateMarker here is neccesary to ensure existing
        // residue spans are updated as react won't update them
        this.updateMarker();

        return <div
            className='msp-alignment-sequence msp-sequence-wrapper'
            onContextMenu={this.contextMenu}
            onMouseDown={this.mouseDown}
            onMouseUp={this.mouseUp}
            onMouseMove={this.mouseMove}
            onMouseLeave={this.mouseLeave}
            ref={this.parentDiv}
        >
            {elems}
        </div>;
    }

}