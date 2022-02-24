/**
 * Copyright (c) 2019-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 *
 * parts adapted from /src/servers/plugin-state/index.ts
 */

import express from 'express';
import compression from 'compression';
import cors from 'cors';
import * as bodyParser from 'body-parser';
import * as fs from 'fs';
import * as path from 'path';
import { swaggerUiIndexHandler, swaggerUiAssetsHandler } from './swagger-ui';
import { makeDir } from './helper/make-dir';
import { getConfig } from './config';
import { UUID } from './helper/uuid';
import { shortcutIconLink, getSchema } from './api-schema';
import { getData, getFrameData } from './helper/helper';

const Config = getConfig();

const app = express();
app.use(compression(<any>{ level: 6, memLevel: 9, chunkSize: 16 * 16384, filter: () => true }));
app.use(cors({ methods: ['GET', 'PUT'] }));
app.use(bodyParser.raw({ inflate: true, type: 'application/zip', limit: '1gb' }));

type Entry = { timestamp: number, id: string, name: string, description: string }

type SessionEntry = Entry & {version: string, isSticky?: boolean}
type SessionIndex = SessionEntry[]

type TrajectoryEntry = Entry
type TrajectoryIndex = TrajectoryEntry[]

type Index = SessionIndex | TrajectoryIndex | []

function createIndex(name: string) {
    const fn = path.join(Config.working_folder, `${name}_index.json`);
    if (fs.existsSync(fn)) return;
    if (!fs.existsSync(Config.working_folder)) makeDir(Config.working_folder);
    if (!fs.existsSync(`${Config.working_folder}/${name}`)) makeDir(`${Config.working_folder}/${name}`);
    fs.writeFileSync(fn, '[]', 'utf-8');
}

function writeIndex(name: string, index: Index) {
    const fn = path.join(Config.working_folder, `${name}_index.json`);
    if (!fs.existsSync(Config.working_folder)) makeDir(Config.working_folder);
    fs.writeFileSync(fn, JSON.stringify(index, null, 2), 'utf-8');
}

function readIndex(name: string): Index {
    const fn = path.join(Config.working_folder, `${name}_index.json`);
    if (!fs.existsSync(fn)) return [];
    switch (name) {
        case 'session': return JSON.parse(fs.readFileSync(fn, 'utf-8')) as SessionIndex;
        case 'trajectory' : return JSON.parse(fs.readFileSync(fn, 'utf-8')) as TrajectoryIndex;
        default: return [];
    }
}

function mapPath(path: string) {
    if (!Config.api_prefix) return path;
    return `/${Config.api_prefix}/${path}`;
}

// SESSION

function removeSession(id: string) {
    const index = readIndex('session') as SessionIndex;
    let i = 0;
    for (const e of index) {
        if (e.id !== id) {
            i++;
            continue;
        }
        if (e.isSticky) return;
        try {
            for (let j = i + 1; j < index.length; j++) {
                index[j - 1] = index[j];
            }
            index.pop();
            writeIndex('session', index);
        } catch { }
        try {
            fs.unlinkSync(path.join(`${Config.working_folder}/session`, `${e.id}.molx`));
        } catch { }
        return;
    }
}

app.get(mapPath(`/get/session/:id/`), (req, res) => {
    const id: string = req.params.id || '';
    console.log('READING SESSION', id);
    if (id.length === 0 || id.indexOf('.') >= 0 || id.indexOf('/') >= 0 || id.indexOf('\\') >= 0) {
        res.status(404);
        res.end();
        return;
    }

    fs.readFile(path.join(`${Config.working_folder}/session`, `${id}.molx`), (err, data) => {
        if (err) {
            console.log(err);
            res.status(404);
            res.end();
            return;
        }

        res.writeHead(200, {
            'Content-Type': 'application/zip',
        });
        res.write(data);
        res.end();
    });
});

app.get(mapPath(`/remove/session/:id`), (req, res) => {
    removeSession((req.params.id as string || '').toLowerCase());
    res.status(200);
    res.end();
});

app.get(mapPath(`/list/:type`), (req, res) => {
    const type: string = req.params.type || '';
    const index = readIndex(type);
    res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
    });
    res.write(JSON.stringify(index, null, 2));
    res.end();
});

app.post(mapPath('/set/session'), (req, res) => {
    console.log('SET SESSION', req.query.name, req.query.description, req.query.version);
    const index = readIndex('session') as SessionIndex;

    const blob = req.body;

    const name = (req.query.name as string || new Date().toUTCString()).substr(0, 50);
    const description = (req.query.description as string || '').substr(0, 100);
    const version = req.query.version as string;

    index.push({ timestamp: +new Date(), id: UUID.createv4(), name, description, version });
    const entry = index[index.length - 1] as SessionEntry;

    fs.writeFile(path.join(`${Config.working_folder}/session`, `${entry.id}.molx`), blob, () => res.end());
    writeIndex('session', index);
});

// TRAJECTORY

app.get(mapPath(`/get/trajectory/:id/starts`), (req, res) => {
    const id: string = req.params.id || '';

    const p = path.join(`${Config.working_folder}/trajectory`, `${id}.xtc`);

    getData(p).then((value) => {
        res.write(`${value}`);
        res.end();
    }).catch((error) => {
        console.log(error);
        res.status(404);
        res.end();
        return;
    });
});

app.get(mapPath(`/get/trajectory/:id/frame/offset/:start/:end`), (req, res) => {
    const id: string = req.params.id || '';
    const tmpStart: string = req.params.start || '-1';
    const tmpEnd: string = req.params.end || '-1';
    let start: number = -1;
    let end: number = -1;

    try {
        start = parseInt(tmpStart);
        end = (tmpEnd === 'Infinity') ? Infinity : parseInt(tmpEnd);
    } catch (e) {
        console.log(e);
        res.status(404);
        res.end();
        return;
    }
    if (start === -1 || end === -1) {
        res.status(404);
        res.end();
        return;
    }

    const p = path.join(`${Config.working_folder}/trajectory`, `${id}.xtc`);

    getFrameData(p, start, end).then((file) => {
        res.json(file);
        res.end();
    }).catch((error) => {
        console.log(error);
        res.status(404);
        res.end();
        return;
    });
});

const schema = getSchema(Config);
app.get(mapPath('/openapi.json'), (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'X-Requested-With'
    });
    res.end(JSON.stringify(schema));
});

app.use(mapPath('/'), swaggerUiAssetsHandler());
app.get(mapPath('/'), swaggerUiIndexHandler({
    openapiJsonUrl: mapPath('/openapi.json'),
    apiPrefix: Config.api_prefix,
    title: 'PluginSession Server API',
    shortcutIconLink
}));


createIndex('session');
createIndex('trajectory');
app.listen(Config.port);

console.log(`Mol* Plugin Session - Trajectory Streaming Server`);
console.log('');
console.log(JSON.stringify(Config, null, 2));

// node lib/commonjs/extensions/remote-session/server/index.js --working-folder ../server/session --port 1337
