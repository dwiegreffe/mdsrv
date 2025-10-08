/**
 * Copyright (c) 2019-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 *
 * parts adapted from /src/servers/plugin-state/index.ts
 */

/**
 * Overview
 * -------
 * This is a small Express-based server for:
 * - Persisting Mol* Plugin sessions as .molx (zip) files and listing/removing them.
 * - Importing molecular dynamics trajectories (XTC) from a remote URL into a working folder.
 * - Exposing minimal APIs to query basic trajectory data (starts/frame-ranges).
 * - Serving an OpenAPI spec and a Swagger UI for interactive exploration.
 *
 * Storage model:
 * - Flat files on disk under a configurable working_folder.
 * - One JSON index per data type: `session_index.json` and `trajectory_index.json`.
 *   These indices are simple catalogs used by the UI to list available entries.
 *
 * Security/operational notes:
 * - The trajectory "upload" actually performs a server-to-server download from a provided URL.
 *   In untrusted environments this can pose SSRF risks; add validation/auth as needed.
 * - No authentication/authorization is implemented; intended for trusted setups or prototyping.
 * - Basic path traversal protections exist for session GET (sanitizing the id path segment).
 */

import express from 'express';
import compression from 'compression';
import cors from 'cors';
import * as bodyParser from 'body-parser';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { swaggerUiIndexHandler, swaggerUiAssetsHandler } from './swagger-ui';
import { makeDir } from './helper/make-dir';
import { getConfig } from './config';
import { UUID } from './helper/uuid';
import { shortcutIconLink, getSchema } from './api-schema';
import { getData, getFrameData } from './helper/helper';
import { rejects } from 'assert';

const Config = getConfig();

const app = express();
// Apply gzip compression for all responses (tuned for larger payloads typical of binary data)
app.use(compression(<any>{ level: 6, memLevel: 9, chunkSize: 16 * 16384, filter: () => true }));
// Allow cross-origin requests for GET/PUT so a separate viewer frontend can talk to this API
app.use(cors({ methods: ['GET', 'PUT'] }));
// Accept raw zip payloads up to 1GB for session uploads (.molx is a zip archive)
app.use(bodyParser.raw({ inflate: true, type: 'application/zip', limit: '1gb' }));

type Entry = { timestamp: number, id: string, name: string, description: string, source: string }

type SessionEntry = Entry & {version: string, isSticky?: boolean}
type SessionIndex = SessionEntry[]

type TrajectoryEntry = Entry
type TrajectoryIndex = TrajectoryEntry[]

type Index = SessionIndex | TrajectoryIndex | []

/** Ensure index file and corresponding subdirectory exist; no-op if already present. */
function createIndex(name: string) {
    const fn = path.join(Config.working_folder, `${name}_index.json`);
    if (fs.existsSync(fn)) return;
    if (!fs.existsSync(Config.working_folder)) makeDir(Config.working_folder);
    if (!fs.existsSync(`${Config.working_folder}/${name}`)) makeDir(`${Config.working_folder}/${name}`);
    fs.writeFileSync(fn, '[]', 'utf-8');
}

/** Persist the provided in-memory index to disk (pretty-printed JSON). */
function writeIndex(name: string, index: Index) {
    const fn = path.join(Config.working_folder, `${name}_index.json`);
    if (!fs.existsSync(Config.working_folder)) makeDir(Config.working_folder);
    fs.writeFileSync(fn, JSON.stringify(index, null, 2), 'utf-8');
}

/** Read an index by type; returns an empty list when the file does not exist. */
function readIndex(name: string): Index {
    const fn = path.join(Config.working_folder, `${name}_index.json`);
    if (!fs.existsSync(fn)) return [];
    switch (name) {
        case 'session': return JSON.parse(fs.readFileSync(fn, 'utf-8')) as SessionIndex;
        case 'trajectory' : return JSON.parse(fs.readFileSync(fn, 'utf-8')) as TrajectoryIndex;
        default: return [];
    }
}

/** Prefix an API path with optional api_prefix from config for mounting under a sub-path. */
function mapPath(path: string) {
    if (!Config.api_prefix) return path;
    return `/${Config.api_prefix}/${path}`;
}

// SESSION

/**
 * Remove a session entry and its .molx file (if not sticky).
 * Updates the index array in-place and deletes the associated archive.
 */
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

/**
 * GET /get/session/:id/
 * Return the .molx archive for a given session id. The id is validated to
 * avoid path traversal by rejecting '.', '/', and '\\'.
 */
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

/** Remove a session by id (no-op if the entry is sticky). */
app.get(mapPath(`/remove/session/:id`), (req, res) => {
    removeSession((req.params.id as string || '').toLowerCase());
    res.status(200);
    res.end();
});

/**
 * GET /list/:type
 * List entries for a given type ('session' | 'trajectory'). Returns JSON.
 */
app.get(mapPath(`/list/:type`), (req, res) => {
    const type: string = req.params.type || '';
    const index = readIndex(type);
    res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
    });
    res.write(JSON.stringify(index, null, 2));
    res.end();
});

/**
 * POST /set/session
 * Store a new session archive (.molx) sent as raw zip in the request body.
 * Metadata (name, description, source, version) are provided via query params.
 * A UUID is generated and used as the filename/id.
 */
app.post(mapPath('/set/session'), (req, res) => {
    console.log('SET SESSION', req.query.name, req.query.description, req.query.version);
    const index = readIndex('session') as SessionIndex;

    const blob = req.body;

    const name = (req.query.name as string || new Date().toUTCString()).substr(0, 50);
    const description = (req.query.description as string || '');
    const source = (req.query.source as string || '');
    const version = req.query.version as string;

    index.push({ timestamp: +new Date(), id: UUID.createv4(), name, description, source, version });
    const entry = index[index.length - 1] as SessionEntry;

    fs.writeFile(path.join(`${Config.working_folder}/session`, `${entry.id}.molx`), blob, () => res.end());
    writeIndex('session', index);
});

// TRAJECTORY

/**
 * GET /upload/trajectory/:url/:name/:description/:source
 *
 * Zweck:
 *  Lädt eine entfernte (öffentliche) XTC-Trajektorie per HTTP(S) Stream herunter und
 *  speichert sie unter <working-folder>/trajectory/<name>.xtc. Anschließend wird
 *  ein Eintrag in den trajectory_index.json aufgenommen.
 *
 * WICHTIG:
 *  - Verwendet HTTP GET zum "Upload" (eigentlich ein Import) — semantisch ungewöhnlich.
 *  - :url muss URL-encodiert werden ("https://host/file.xtc" → "https:%2F%2Fhost%2Ffile.xtc").
 *  - Keine Authentifizierung oder Validierung der Ziel-URL -> mögliches SSRF Risiko.
 *  - Existiert <name>.xtc bereits, wird abgebrochen (kein Überschreiben).
 *  - Fehler beim Download führen zum Löschen der angelegten Datei.
 *  - Antwort bei Erfolg: Text "Trajectory uploaded." (HTTP 200)
 *
 * Pfadparameter:
 *  :url          URL-encodierte Quelle (muss direkt eine XTC Datei liefern)
 *  :name         Dateiname (ohne .xtc) + Index-ID
 *  :description  Freitextbeschreibung
 *  :source       Freitext (z.B. Herkunft/System)
 *
 * Beispiel:
 *  GET /upload/trajectory/https:%2F%2Ffiles.example.org%2Fsim%2Ftraj1.xtc/traj1/Test/SystemA
 */
app.get(mapPath(`/upload/trajectory/:url/:name/:description/:source`), (req, res) => {
    console.log('UPLOAD TRAJECTORY', req.params.url, req.params.name, req.params.description);
    const index = readIndex('trajectory') as TrajectoryIndex;

    // Extrahiere und normalisiere Pfadparameter
    const url: string = req.params.url; // Erwartet encodierte URL
    const name = (req.params.name as string || new Date().toUTCString());
    const description = (req.params.description as string || '');
    const source = (req.params.source as string || '');

    // Zielpfad der XTC Datei
    const fn = `${Config.working_folder}/trajectory/${name}.xtc`;

    // Verhindere Überschreiben bestehender Dateien
    if (fs.existsSync(fn)) {
        res.write('File name already exists. Pick different file name.');
        console.log(`File name ${name} already exists. Return`);
        res.end();
        return;
    }

    // Bereite Write Stream vor (chunked Schreiben während des Downloads)
    const writeableStream = fs.createWriteStream(fn);

    // Lade entfernte Ressource per Streaming
    fetch(url)
        .then(response => {
            if (response.status === 404) {
                // Dateiname nicht gefunden -> Fehler werfen
                throw new Error(`${response.status} file not found (URL)`);
            }
            return response.body; // Node.js Readable Stream
        })
        .then(body => {
            console.log(body.readable);

            // Schreibe eingehende Daten in die Zieldatei
            body.on('data', (chunk: Buffer) => {
                writeableStream.write(chunk);
            });

            // Bei Ende: Index-Eintrag hinzufügen und persistieren
            body.on('end', () => {
                index.push({ timestamp: +new Date(), id: name, name, description, source });
                writeIndex('trajectory', index);
                console.log(`Trajectory ${name}.xtc uploaded`);
                res.write('Trajectory uploaded.');
                res.end();
            });

            // Fehler während Streaming
            body.on('error', error => {
                rejects(error); // meldet den Promise-Reject (import aus assert) – TODO: könnte ersetzt werden
                res.end();
            });
        })
        .catch(error => {
            console.log('Error while fetching:');
            console.log(error);
            // Aufräumen (angelegte, unvollständige Datei entfernen)
            fs.unlinkSync(fn);
            res.write(`${error}`);
            res.end();
        });
});

/**
 * GET /get/trajectory/:id/starts
 * Return trajectory "starts" metadata for the XTC file identified by :id.
 * Delegates actual reading/parsing to helper `getData`.
 */
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

/**
 * GET /get/trajectory/:id/frame/offset/:start/:end
 * Return frame data for the given [start, end) offsets. Accepts 'Infinity' for open end.
 * Uses `getFrameData` helper to read/convert the requested range.
 */
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
// Expose OpenAPI document to be consumed by Swagger UI or external tools
app.get(mapPath('/openapi.json'), (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'X-Requested-With'
    });
    res.end(JSON.stringify(schema));
});

// Serve Swagger UI assets and an index page wired to the generated OpenAPI schema
app.use(mapPath('/'), swaggerUiAssetsHandler());
app.get(mapPath('/'), swaggerUiIndexHandler({
    openapiJsonUrl: mapPath('/openapi.json'),
    apiPrefix: Config.api_prefix,
    title: 'PluginSession Server API',
    shortcutIconLink
}));


// Ensure both indices exist before serving requests and start listening
createIndex('session');
createIndex('trajectory');
app.listen(Config.port);

console.log(`Mol* Plugin Session - Trajectory Streaming Server`);
console.log('');
console.log(JSON.stringify(Config, null, 2));

// node lib/commonjs/extensions/remote-session/server/index.js --working-folder ../server/session --port 1337
