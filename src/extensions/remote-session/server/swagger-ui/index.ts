/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import * as express from 'express';
import { getAbsoluteFSPath } from 'swagger-ui-dist';
import { ServeStaticOptions } from 'serve-static';
import { Handler } from 'express-serve-static-core';
import { indexTemplate } from './indexTemplate';

export function swaggerUiAssetsHandler(options?: ServeStaticOptions): Handler {
    const opts = options || {};
    opts.index = false;
    return express.static(getAbsoluteFSPath(), opts);
}

export interface SwaggerUIOptions {
    openapiJsonUrl: string
    apiPrefix: string
    title: string
    shortcutIconLink: string
}

function createHTML(options: SwaggerUIOptions) {
    return interpolate(indexTemplate, options);
}

export function swaggerUiIndexHandler(options: SwaggerUIOptions): express.Handler {
    const html = createHTML(options);
    return (req: express.Request, res: express.Response) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
    };
}

//
// src/mol-util/string.ts
export function interpolate(str: string, params: { [k: string]: any }) {
    const names = Object.keys(params);
    const values = Object.values(params);
    return new Function(...names, `return \`${str}\`;`)(...values);
}