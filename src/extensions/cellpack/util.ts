/**
 * Copyright (c) 2019-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author Ludovic Autin <ludovic.autin@gmail.com>
 */

import { CIF } from '../../mol-io/reader/cif';
import { parsePDB } from '../../mol-io/reader/pdb/parser';
import { AssetManager, Asset } from '../../mol-util/assets';
import { Structure } from '../../mol-model/structure';
import { Vec3 } from '../../mol-math/linear-algebra';
import { PluginContext } from '../../mol-plugin/context';

export async function parseCif(plugin: PluginContext, data: string | Uint8Array) {
    const comp = CIF.parse(data);
    const parsed = await plugin.runTask(comp);
    if (parsed.isError) throw parsed;
    return parsed.result;
}

export async function parsePDBfile(plugin: PluginContext, data: string, id: string) {
    const comp = parsePDB(data, id);
    const parsed = await plugin.runTask(comp);
    if (parsed.isError) throw parsed;
    return parsed.result;
}

async function downloadCif(plugin: PluginContext, url: string, isBinary: boolean, assetManager: AssetManager) {
    const type = isBinary ? 'binary' : 'string';
    const asset = await plugin.runTask(assetManager.resolve(Asset.getUrlAsset(assetManager, url), type));
    return { cif: await parseCif(plugin, asset.data), asset };
}

async function downloadPDB(plugin: PluginContext, url: string, id: string, assetManager: AssetManager) {
    const asset = await assetManager.resolve(Asset.getUrlAsset(assetManager, url), 'string').run();
    return { pdb: await parsePDBfile(plugin, asset.data, id), asset };
}

export async function getFromPdb(plugin: PluginContext, pdbId: string, assetManager: AssetManager) {
    const { cif, asset } = await downloadCif(plugin, `https://models.rcsb.org/${pdbId}.bcif`, true, assetManager);
    return { mmcif: cif.blocks[0], asset };
}

export async function getFromOPM(plugin: PluginContext, pdbId: string, assetManager: AssetManager) {
    const asset = await plugin.runTask(assetManager.resolve(Asset.getUrlAsset(assetManager, `https://opm-assets.storage.googleapis.com/pdb/${pdbId.toLowerCase()}.pdb`), 'string'));
    return { pdb: await parsePDBfile(plugin, asset.data, pdbId), asset };
}

export async function getFromCellPackDB(plugin: PluginContext, id: string, baseUrl: string, assetManager: AssetManager) {
    if (id.toLowerCase().endsWith('.cif') || id.toLowerCase().endsWith('.bcif')) {
        const isBinary = id.toLowerCase().endsWith('.bcif');
        const { cif, asset } = await downloadCif(plugin, `${baseUrl}/other/${id}`, isBinary, assetManager);
        return { mmcif: cif.blocks[0], asset };
    } else {
        const name = id.endsWith('.pdb') ? id.substring(0, id.length - 4) : id;
        return await downloadPDB(plugin, `${baseUrl}/other/${name}.pdb`, name, assetManager);
    }
}

export type IngredientFiles = { [name: string]: Asset.File }

export function getStructureMean(structure: Structure) {
    let xSum = 0, ySum = 0, zSum = 0;
    for (let i = 0, il = structure.units.length; i < il; ++i) {
        const unit = structure.units[i];
        const { elements } = unit;
        const { x, y, z } = unit.conformation;
        for (let j = 0, jl = elements.length; j < jl; ++j) {
            const eI = elements[j];
            xSum += x(eI);
            ySum += y(eI);
            zSum += z(eI);
        }
    }
    const { elementCount } = structure;
    return Vec3.create(xSum / elementCount, ySum / elementCount, zSum / elementCount);
}

export function getFloatValue(value: DataView, offset: number) {
    // if the last byte is a negative value (MSB is 1), the final
    // float should be too
    const negative = value.getInt8(offset + 2) >>> 31;

    // this is how the bytes are arranged in the byte array/DataView
    // buffer
    const [b0, b1, b2, exponent] = [
        // get first three bytes as unsigned since we only care
        // about the last 8 bits of 32-bit js number returned by
        // getUint8().
        // Should be the same as: getInt8(offset) & -1 >>> 24
        value.getUint8(offset),
        value.getUint8(offset + 1),
        value.getUint8(offset + 2),

        // get the last byte, which is the exponent, as a signed int
        // since it's already correct
        value.getInt8(offset + 3)
    ];

    let mantissa = b0 | (b1 << 8) | (b2 << 16);
    if (negative) {
        // need to set the most significant 8 bits to 1's since a js
        // number is 32 bits but our mantissa is only 24.
        mantissa |= 255 << 24;
    }

    return mantissa * Math.pow(10, exponent);
}