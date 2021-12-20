/**
 * Copyright (c) 2017-2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { UniqueArray } from '../../mol-data/generic';

export { InterUnitGraph };

class InterUnitGraph<UnitId extends number, VertexIndex extends number, EdgeProps extends InterUnitGraph.EdgePropsBase = {}> {
    /** Number of inter-unit edges */
    readonly edgeCount: number;
    /** Array of inter-unit edges */
    readonly edges: ReadonlyArray<InterUnitGraph.Edge<UnitId, VertexIndex, EdgeProps>>;
    private readonly edgeKeyIndex: Map<string, number>;
    private readonly vertexKeyIndex: Map<string, number[]>;

    /** Get an array of unit-pair-edges that are connected to the given unit */
    getConnectedUnits(unit: UnitId): ReadonlyArray<InterUnitGraph.UnitPairEdges<UnitId, VertexIndex, EdgeProps>> {
        if (!this.map.has(unit)) return emptyArray;
        return this.map.get(unit)!;
    }

    /** Index into this.edges */
    getEdgeIndex(indexA: VertexIndex, unitA: UnitId, indexB: VertexIndex, unitB: UnitId): number {
        const edgeKey = InterUnitGraph.getEdgeKey<UnitId, VertexIndex>(indexA, unitA, indexB, unitB);
        const index = this.edgeKeyIndex.get(edgeKey);
        return index !== undefined ? index : -1;
    }

    /** Check if edge exists */
    hasEdge(indexA: VertexIndex, unitA: UnitId, indexB: VertexIndex, unitB: UnitId): boolean {
        return this.getEdgeIndex(indexA, unitA, indexB, unitB) !== -1;
    }

    /** Get inter-unit edge given a pair of indices and units */
    getEdge(indexA: VertexIndex, unitA: UnitId, indexB: VertexIndex, unitB: UnitId): InterUnitGraph.Edge<UnitId, VertexIndex, EdgeProps> | undefined {
        const index = this.getEdgeIndex(indexA, unitA, indexB, unitB);
        return index !== -1 ? this.edges[index] : undefined;
    }

    /** Indices into this.edges */
    getEdgeIndices(index: VertexIndex, unit: UnitId): ReadonlyArray<number> {
        return this.vertexKeyIndex.get(InterUnitGraph.getVertexKey(index, unit)) || [];
    }

    constructor(protected readonly map: Map<number, InterUnitGraph.UnitPairEdges<UnitId, VertexIndex, EdgeProps>[]>) {
        let count = 0;
        const edges: (InterUnitGraph.Edge<UnitId, VertexIndex, EdgeProps>)[] = [];
        const edgeKeyIndex = new Map<string, number>();
        const vertexKeyIndex = new Map<string, number[]>();

        this.map.forEach(pairEdgesArray => {
            pairEdgesArray.forEach(pairEdges => {
                count += pairEdges.edgeCount;
                pairEdges.connectedIndices.forEach(indexA => {
                    pairEdges.getEdges(indexA).forEach(edgeInfo => {
                        const { unitA, unitB } = pairEdges;

                        const edgeKey = InterUnitGraph.getEdgeKey(indexA, unitA, edgeInfo.indexB, unitB);
                        edgeKeyIndex.set(edgeKey, edges.length);

                        const vertexKey = InterUnitGraph.getVertexKey(indexA, unitA);
                        const e = vertexKeyIndex.get(vertexKey);
                        if (e === undefined) vertexKeyIndex.set(vertexKey, [edges.length]);
                        else e.push(edges.length);

                        edges.push({ ...edgeInfo, indexA, unitA, unitB });
                    });
                });
            });
        });

        this.edgeCount = count;
        this.edges = edges;
        this.edgeKeyIndex = edgeKeyIndex;
        this.vertexKeyIndex = vertexKeyIndex;
    }
}

namespace InterUnitGraph {
    export class UnitPairEdges<UnitId extends number, VertexIndex extends number, EdgeProps extends EdgePropsBase = {}> {
        hasEdges(indexA: VertexIndex) {
            return this.edgeMap.has(indexA);
        }

        getEdges(indexA: VertexIndex): ReadonlyArray<EdgeInfo<VertexIndex, EdgeProps>> {
            if (!this.edgeMap.has(indexA)) return emptyArray;
            return this.edgeMap.get(indexA)!;
        }

        get areUnitsOrdered() {
            return this.unitA < this.unitB;
        }

        constructor(public unitA: UnitId, public unitB: UnitId,
            public edgeCount: number, public connectedIndices: ReadonlyArray<VertexIndex>,
            private edgeMap: Map<number, EdgeInfo<VertexIndex, EdgeProps>[]>) {
        }
    }

    export type EdgePropsBase = { [name: string]: any }

    export interface EdgeInfo<VertexIndex extends number, EdgeProps extends EdgePropsBase = {}> {
        /** indexInto */
        readonly indexB: VertexIndex,
        readonly props: EdgeProps
    }

    export interface Edge<UnitId extends number, VertexIndex extends number, EdgeProps extends EdgePropsBase = {}> {
        readonly unitA: UnitId,
        readonly unitB: UnitId,
        readonly indexA: VertexIndex,
        readonly indexB: VertexIndex,
        readonly props: EdgeProps
    }

    export function getEdgeKey<UnitId extends number, VertexIndex extends number>(indexA: VertexIndex, unitA: UnitId, indexB: VertexIndex, unitB: UnitId) {
        return `${indexA}|${unitA}|${indexB}|${unitB}`;
    }

    export function getVertexKey<UnitId extends number, VertexIndex extends number>(index: VertexIndex, unit: UnitId) {
        return `${index}|${unit}`;
    }

    //

    function addMapEntry<A, B>(map: Map<A, B[]>, a: A, b: B) {
        if (map.has(a)) map.get(a)!.push(b);
        else map.set(a, [b]);
    }


    export class Builder<UnitId extends number, VertexIndex extends number, EdgeProps extends InterUnitGraph.EdgePropsBase = {}> {
        private uA: UnitId;
        private uB: UnitId;
        private mapAB: Map<number, EdgeInfo<VertexIndex, EdgeProps>[]>;
        private mapBA: Map<number, EdgeInfo<VertexIndex, EdgeProps>[]>;
        private linkedA: UniqueArray<VertexIndex, VertexIndex>;
        private linkedB: UniqueArray<VertexIndex, VertexIndex>;
        private linkCount: number;

        private map = new Map<number, UnitPairEdges<UnitId, VertexIndex, EdgeProps>[]>();

        startUnitPair(unitA: UnitId, unitB: UnitId) {
            this.uA = unitA;
            this.uB = unitB;
            this.mapAB = new Map();
            this.mapBA = new Map();
            this.linkedA = UniqueArray.create();
            this.linkedB = UniqueArray.create();
            this.linkCount = 0;
        }

        finishUnitPair() {
            if (this.linkCount === 0) return;
            addMapEntry(this.map, this.uA, new UnitPairEdges(this.uA, this.uB, this.linkCount, this.linkedA.array, this.mapAB));
            addMapEntry(this.map, this.uB, new UnitPairEdges(this.uB, this.uA, this.linkCount, this.linkedB.array, this.mapBA));
        }

        add(indexA: VertexIndex, indexB: VertexIndex, props: EdgeProps) {
            addMapEntry(this.mapAB, indexA, { indexB, props });
            addMapEntry(this.mapBA, indexB, { indexB: indexA, props });
            UniqueArray.add(this.linkedA, indexA, indexA);
            UniqueArray.add(this.linkedB, indexB, indexB);
            this.linkCount += 1;
        }

        getMap(): Map<number, InterUnitGraph.UnitPairEdges<UnitId, VertexIndex, EdgeProps>[]> {
            return this.map;
        }
    }
}

const emptyArray: any[] = [];