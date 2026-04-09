import * as fs from 'fs';

const MagicInts = new Uint32Array([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 10, 12, 16, 20, 25, 32, 40, 50, 64,
    80, 101, 128, 161, 203, 256, 322, 406, 512, 645, 812, 1024, 1290,
    1625, 2048, 2580, 3250, 4096, 5060, 6501, 8192, 10321, 13003,
    16384, 20642, 26007, 32768, 41285, 52015, 65536, 82570, 104031,
    131072, 165140, 208063, 262144, 330280, 416127, 524287, 660561,
    832255, 1048576, 1321122, 1664510, 2097152, 2642245, 3329021,
    4194304, 5284491, 6658042, 8388607, 10568983, 13316085, 16777216
]);

export const FirstIdx = 9;

namespace Decoder {
    export function sizeOfInts(numOfInts: number, sizes: number[]) {
        let numOfBytes = 1;
        let numOfBits = 0;
        _tmpBytes[0] = 1;
        for (let i = 0; i < numOfInts; i++) {
            let bytecnt;
            let tmp = 0;
            for (bytecnt = 0; bytecnt < numOfBytes; bytecnt++) {
                tmp += _tmpBytes[bytecnt] * sizes[i];
                _tmpBytes[bytecnt] = tmp & 0xff;
                tmp >>= 8;
            }
            while (tmp !== 0) {
                _tmpBytes[bytecnt++] = tmp & 0xff;
                tmp >>= 8;
            }
            numOfBytes = bytecnt;
        }
        let num = 1;
        numOfBytes--;
        while (_tmpBytes[numOfBytes] >= num) {
            numOfBits++;
            num *= 2;
        }
        return numOfBits + numOfBytes * 8;
    }

    const _tmpBytes = new Uint8Array(32);
    const _buffer = new ArrayBuffer(8 * 3);
    export const buf = new Int32Array(_buffer);
    const uint32view = new Uint32Array(_buffer);

    export function decodeBits(cbuf: Uint8Array, offset: number, numOfBits1: number) {
        let numOfBits = numOfBits1;
        const mask = (1 << numOfBits) - 1;
        let lastBB0 = uint32view[1];
        let lastBB1 = uint32view[2];
        let cnt = buf[0];
        let num = 0;

        while (numOfBits >= 8) {
            lastBB1 = (lastBB1 << 8) | cbuf[offset + cnt++];
            num |= (lastBB1 >> lastBB0) << (numOfBits - 8);
            numOfBits -= 8;
        }

        if (numOfBits > 0) {
            if (lastBB0 < numOfBits) {
                lastBB0 += 8;
                lastBB1 = (lastBB1 << 8) | cbuf[offset + cnt++];
            }
            lastBB0 -= numOfBits;
            num |= (lastBB1 >> lastBB0) & ((1 << numOfBits) - 1);
        }

        num &= mask;
        buf[0] = cnt;
        buf[1] = lastBB0;
        buf[2] = lastBB1;

        return num;
    }

    function decodeByte(cbuf: Uint8Array, offset: number) {
        let lastBB1 = uint32view[2];
        const cnt = buf[0];
        lastBB1 = (lastBB1 << 8) | cbuf[offset + cnt];
        buf[0] = cnt + 1;
        buf[2] = lastBB1;
        return (lastBB1 >> uint32view[1]) & 0xff;
    }

    const intBytes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    export function decodeInts(cbuf: Uint8Array, offset: number, numOfBits1: number, sizes: number[], nums: number[]) {
        let numOfBits = numOfBits1;
        let numOfBytes = 0;

        intBytes[0] = 0;
        intBytes[1] = 0;
        intBytes[2] = 0;
        intBytes[3] = 0;

        while (numOfBits > 8) {
            intBytes[numOfBytes++] = decodeByte(cbuf, offset);
            numOfBits -= 8;
        }

        if (numOfBits > 0) {
            intBytes[numOfBytes++] = decodeBits(cbuf, offset, numOfBits);
        }

        for (let i = 2; i > 0; i--) {
            let num = 0;
            const s = sizes[i];
            for (let j = numOfBytes - 1; j >= 0; j--) {
                num = (num << 8) | intBytes[j];
                const t = (num / s) | 0;
                intBytes[j] = t;
                num = num - t * s;
            }
            nums[i] = num;
        }
        nums[0] = intBytes[0] | (intBytes[1] << 8) | (intBytes[2] << 16) | (intBytes[3] << 24);
    }
}

export interface XtcFile {
    frames: { count: number, x: Float32Array, y: Float32Array, z: Float32Array }[],
    boxes: number[][],
    times: number[],
    timeOffset: number,
    deltaTime: number
}

export async function getFrameStarts(path: string) {
    const stream = fs.createReadStream(path, { highWaterMark: 1024 * 1024 * 1024 });

    return new Promise<number[]>((resolve, reject) => {
        let restData: Uint8Array = new Uint8Array();
        let globalOffset = 0;
        const offsets: number[] = [];

        stream.on('data', (chunk: Buffer) => {
            const data: Uint8Array = concatAll([restData, new Uint8Array(chunk, chunk.byteOffset)]);
            const result = getOffsets(data, globalOffset);

            if (result.restOffset === 0) {
                offsets.push(...result.finishedOffsets);
                globalOffset = result.globalOffset;
                restData = new Uint8Array();
            } else {
                offsets.push(...result.finishedOffsets);
                globalOffset = result.globalOffset;
                restData = data.slice(result.restOffset);
            }
        });

        stream.on('end', () => resolve(offsets));
        stream.on('error', error => reject(error));
    });
}

type FrameResult = {
    finishedOffsets: number[],
    restOffset: number,
    globalOffset: number
}

export function getOffsets(data: Uint8Array, g: number): FrameResult {
    const dv = new DataView(data.buffer, data.byteOffset);
    let globalOffset = g;
    let localOffset = 0;
    const offsetArray: number[] = [];

    while (true) {
        let frameOffset = 0;
        try {
            const natoms = dv.getInt32(localOffset + frameOffset + 4);
            frameOffset += 52;

            if (natoms <= 9) {
                for (let i = 0; i < natoms / 3; ++i) frameOffset += 4;
            } else {
                frameOffset += 36;
                const adz = Math.ceil(dv.getInt32(localOffset + frameOffset) / 4) * 4;
                frameOffset += 4;
                frameOffset += adz;
            }
        } catch {
            return { finishedOffsets: offsetArray, restOffset: localOffset, globalOffset };
        }

        if (localOffset + frameOffset > dv.byteLength) {
            return { finishedOffsets: offsetArray, restOffset: localOffset, globalOffset };
        }

        offsetArray.push(globalOffset);
        localOffset += frameOffset;
        globalOffset += frameOffset;

        if (localOffset + frameOffset === dv.byteLength) {
            return { finishedOffsets: offsetArray, restOffset: 0, globalOffset };
        }
    }
}

export function concatAll(arrays: Uint8Array[]) {
    let totalLength = 0;
    for (const arr of arrays) totalLength += arr.length;
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

export function getFrameData(path: string, start: number, end: number) {
    const stream = fs.createReadStream(path, { start, end });

    return new Promise<XtcFile>((resolve, reject) => {
        let data: Uint8Array = new Uint8Array();

        stream.on('data', (chunk: Buffer) => {
            data = concatAll([data, new Uint8Array(chunk, chunk.byteOffset)]);
        });

        stream.on('end', () => resolve(getFrameFile(data)));
        stream.on('error', error => reject(error));
    });
}

export function getFrameFile(data: Uint8Array) {
    const dv = new DataView(data.buffer, data.byteOffset);

    const f: XtcFile = {
        frames: [],
        boxes: [],
        times: [],
        timeOffset: 0,
        deltaTime: 0
    };

    const coordinates = f.frames;
    const boxes = f.boxes;
    const times = f.times;

    const minMaxInt = [0, 0, 0, 0, 0, 0];
    const sizeint = [0, 0, 0];
    const bitsizeint = [0, 0, 0];
    const sizesmall = [0, 0, 0];
    const thiscoord = [0.1, 0.1, 0.1];
    const prevcoord = [0.1, 0.1, 0.1];

    let offset = 0;
    let frameCount = 0;
    while (offset < dv.byteLength) {
        const natoms = dv.getInt32(offset + 4);
        const time = dv.getFloat32(offset + 12);
        times.push(time);
        if (frameCount === 0) f.timeOffset = time;
        else if (frameCount === 1) f.deltaTime = time - f.timeOffset;

        const box = [
            dv.getFloat32(offset + 16), dv.getFloat32(offset + 20), dv.getFloat32(offset + 24),
            dv.getFloat32(offset + 28), dv.getFloat32(offset + 32), dv.getFloat32(offset + 36),
            dv.getFloat32(offset + 40), dv.getFloat32(offset + 44), dv.getFloat32(offset + 48)
        ];
        boxes.push(box);

        offset += 52;
        const frame = { count: natoms, x: new Float32Array(natoms), y: new Float32Array(natoms), z: new Float32Array(natoms) };
        coordinates.push(frame);

        if (natoms <= 9) {
            for (let i = 0; i < natoms; ++i) {
                frame.x[i] = dv.getFloat32(offset); offset += 4;
                frame.y[i] = dv.getFloat32(offset); offset += 4;
                frame.z[i] = dv.getFloat32(offset); offset += 4;
            }
        } else {
            const lsize = dv.getInt32(offset); offset += 4;
            const precision = dv.getFloat32(offset); offset += 4;
            minMaxInt[0] = dv.getInt32(offset); offset += 4;
            minMaxInt[1] = dv.getInt32(offset); offset += 4;
            minMaxInt[2] = dv.getInt32(offset); offset += 4;
            minMaxInt[3] = dv.getInt32(offset); offset += 4;
            minMaxInt[4] = dv.getInt32(offset); offset += 4;
            minMaxInt[5] = dv.getInt32(offset); offset += 4;
            let smallidx = dv.getInt32(offset); offset += 4;

            sizeint[0] = minMaxInt[3] - minMaxInt[0] + 1;
            sizeint[1] = minMaxInt[4] - minMaxInt[1] + 1;
            sizeint[2] = minMaxInt[5] - minMaxInt[2] + 1;

            let bitsize;
            if ((sizeint[0] | sizeint[1] | sizeint[2]) > 0xffffff) {
                bitsizeint[0] = Decoder.sizeOfInts(3, sizeint);
                bitsize = 0;
            } else {
                bitsize = Decoder.sizeOfInts(3, sizeint);
                bitsizeint[0] = 0;
            }

            const buf = Decoder.buf;
            buf[0] = 0;
            buf[1] = 0;
            buf[2] = 0;
            const compressedCoords = new Int32Array(natoms * 3);
            let run = 0;
            let i = 0;
            while (i < natoms) {
                if (bitsize === 0) Decoder.decodeInts(data, offset, bitsizeint[0], sizeint, thiscoord);
                else {
                    thiscoord[0] = Decoder.decodeBits(data, offset, bitsize);
                    thiscoord[1] = Decoder.decodeBits(data, offset, bitsize);
                    thiscoord[2] = Decoder.decodeBits(data, offset, bitsize);
                }

                thiscoord[0] += minMaxInt[0];
                thiscoord[1] += minMaxInt[1];
                thiscoord[2] += minMaxInt[2];

                compressedCoords[3 * i] = thiscoord[0];
                compressedCoords[3 * i + 1] = thiscoord[1];
                compressedCoords[3 * i + 2] = thiscoord[2];
                i++;

                const flag = Decoder.decodeBits(data, offset, 1);
                isizeLoop: if (flag === 1) {
                    run = Decoder.decodeBits(data, offset, 5);
                    const isSmaller = run % 3;
                    run -= isSmaller;
                    isizeLoop2: for (let k = 0; k < run; k += 3) {
                        sizesmall[0] = MagicInts[smallidx] / 2;
                        sizesmall[1] = MagicInts[smallidx] / 2;
                        sizesmall[2] = MagicInts[smallidx] / 2;
                        Decoder.decodeInts(data, offset, Decoder.sizeOfInts(3, sizesmall), sizesmall, thiscoord);
                        thiscoord[0] += prevcoord[0] - sizesmall[0];
                        thiscoord[1] += prevcoord[1] - sizesmall[1];
                        thiscoord[2] += prevcoord[2] - sizesmall[2];
                        compressedCoords[3 * i] = thiscoord[0];
                        compressedCoords[3 * i + 1] = thiscoord[1];
                        compressedCoords[3 * i + 2] = thiscoord[2];
                        if (k === 0) {
                            compressedCoords[3 * i] = compressedCoords[3 * i - 3];
                            compressedCoords[3 * i + 1] = compressedCoords[3 * i - 2];
                            compressedCoords[3 * i + 2] = compressedCoords[3 * i - 1];
                            compressedCoords[3 * i - 3] = thiscoord[0];
                            compressedCoords[3 * i - 2] = thiscoord[1];
                            compressedCoords[3 * i - 1] = thiscoord[2];
                        } else {
                            prevcoord[0] = thiscoord[0];
                            prevcoord[1] = thiscoord[1];
                            prevcoord[2] = thiscoord[2];
                        }
                        i++;
                    }
                    smallidx += isSmaller - 1;
                } else {
                    prevcoord[0] = thiscoord[0];
                    prevcoord[1] = thiscoord[1];
                    prevcoord[2] = thiscoord[2];
                }
            }

            const adz = Math.ceil(lsize / 4) * 4;
            offset += adz;

            for (let j = 0; j < natoms; ++j) {
                frame.x[j] = compressedCoords[3 * j] / precision;
                frame.y[j] = compressedCoords[3 * j + 1] / precision;
                frame.z[j] = compressedCoords[3 * j + 2] / precision;
            }
        }
        frameCount++;
    }

    return f;
}
