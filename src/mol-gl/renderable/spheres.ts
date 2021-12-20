/**
 * Copyright (c) 2019-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { Renderable, RenderableState, createRenderable } from '../renderable';
import { WebGLContext } from '../webgl/context';
import { createGraphicsRenderItem } from '../webgl/render-item';
import { GlobalUniformSchema, BaseSchema, AttributeSpec, Values, InternalSchema, SizeSchema, InternalValues, ElementsSpec, ValueSpec, DefineSpec, GlobalTextureSchema, UniformSpec } from './schema';
import { SpheresShaderCode } from '../shader-code';
import { ValueCell } from '../../mol-util';

export const SpheresSchema = {
    ...BaseSchema,
    ...SizeSchema,
    aGroup: AttributeSpec('float32', 1, 0),
    aPosition: AttributeSpec('float32', 3, 0),
    aMapping: AttributeSpec('float32', 2, 0),
    elements: ElementsSpec('uint32'),

    padding: ValueSpec('number'),
    dDoubleSided: DefineSpec('boolean'),
    dIgnoreLight: DefineSpec('boolean'),
    dXrayShaded: DefineSpec('boolean'),
    uBumpFrequency: UniformSpec('f'),
    uBumpAmplitude: UniformSpec('f'),
};
export type SpheresSchema = typeof SpheresSchema
export type SpheresValues = Values<SpheresSchema>

export function SpheresRenderable(ctx: WebGLContext, id: number, values: SpheresValues, state: RenderableState, materialId: number): Renderable<SpheresValues> {
    const schema = { ...GlobalUniformSchema, ...GlobalTextureSchema, ...InternalSchema, ...SpheresSchema };
    const internalValues: InternalValues = {
        uObjectId: ValueCell.create(id),
    };
    const shaderCode = SpheresShaderCode;
    const renderItem = createGraphicsRenderItem(ctx, 'triangles', shaderCode, schema, { ...values, ...internalValues }, materialId);
    return createRenderable(renderItem, values, state);
}