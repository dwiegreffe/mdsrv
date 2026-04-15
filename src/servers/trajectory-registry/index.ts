import express from 'express';
import compression from 'compression';
import cors from 'cors';
import * as bodyParser from 'body-parser';
import fetch from 'node-fetch';
import { swaggerUiAssetsHandler, swaggerUiIndexHandler } from '../common/swagger-ui';
import { getConfig } from './config';
import { createTrajectoryEntry, ensureTrajectoryDataDirectory, getTrajectoryEntry, getTrajectoryFilePath, listTrajectoryEntries, normalizeTrajectoryId, normalizeXtcFileName, readTrajectoryFile, removeTrajectoryEntry } from './storage';
import { getFrameRangeData, getFrameStarts, getSingleFrameData } from './xtc';
import { getSchema, shortcutIconLink } from './api-schema';

const Config = getConfig();
const ApiRoot = '/api/v1/trajectory';

const app = express();
app.use(compression(<any>{ level: 6, memLevel: 9, chunkSize: 16 * 16384, filter: () => true }));
app.use(cors({ methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.raw({ type: ['application/octet-stream'], limit: Config.upload_limit }));

function mapPath(path: string) {
    if (!Config.api_prefix) return path;
    return `/${Config.api_prefix}/${path}`;
}

function writeError(res: express.Response, status: number, message: string, code?: string) {
    res.status(status);
    res.json({ errors: [{ code: code || 'request', message }] });
}

function parseTrajectoryId(rawId: string, res: express.Response) {
    try {
        return normalizeTrajectoryId(rawId || '');
    } catch (e) {
        writeError(res, 400, e instanceof Error ? e.message : 'Invalid trajectory id.', 'valid-id');
        return void 0;
    }
}

function parseFramePosition(value: string, field: 'start' | 'end', res: express.Response) {
    if (field === 'end' && value === 'Infinity') return Infinity;
    const parsed = parseInt(value || '-1', 10);
    if (Number.isNaN(parsed) || parsed < 0) {
        writeError(res, 400, `Invalid frame ${field} offset.`, 'valid-frame-range');
        return void 0;
    }
    return parsed;
}

async function resolveTrajectoryFilePath(id: string, res: express.Response) {
    const entry = getTrajectoryEntry(Config, id);
    if (!entry) {
        writeError(res, 404, `Trajectory '${id}' does not exist.`, 'missing-trajectory');
        return void 0;
    }
    return getTrajectoryFilePath(Config, entry.fileName);
}

async function sendSingleFrame(filePath: string, start: number, end: number, res: express.Response) {
    if (end !== Infinity && end <= start) return writeError(res, 400, 'Frame end offset must be greater than frame start offset.', 'valid-frame-range');
    try {
        const file = await getSingleFrameData(filePath, start, end);
        res.json(file);
    } catch {
        return writeError(res, 404, `Frame '${start}:${end}' could not be read.`, 'missing-frame');
    }
}

async function sendFrameRange(filePath: string, start: number, end: number, res: express.Response) {
    if (end !== Infinity && end <= start) return writeError(res, 400, 'Frame range end offset must be greater than frame range start offset.', 'valid-frame-range');
    try {
        const file = await getFrameRangeData(filePath, start, end);
        res.json(file);
    } catch {
        return writeError(res, 404, `Frame range '${start}:${end}' could not be read.`, 'missing-frame');
    }
}

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === 'entity.too.large') return writeError(res, 413, `Upload exceeds configured limit '${Config.upload_limit}'.`, 'upload-limit');
    next(err);
});

app.get(mapPath(ApiRoot), (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(listTrajectoryEntries(Config)));
});

app.post(mapPath(ApiRoot), async (req, res) => {
    const url = req.body?.url as string | undefined;
    const rawId = req.body?.id as string | undefined;
    const name = (req.body?.name as string | undefined) || rawId || '';
    const description = (req.body?.description as string | undefined) || '';
    const source = (req.body?.source as string | undefined) || '';

    if (!url) return writeError(res, 400, 'Trajectory upload requires a source URL.', 'missing-url');

    let id: string;
    let fileName: string;
    try {
        id = normalizeTrajectoryId(rawId || '');
        fileName = normalizeXtcFileName(`${id}.xtc`);
    } catch (e) {
        return writeError(res, 400, e instanceof Error ? e.message : 'Invalid trajectory payload.', 'valid-trajectory');
    }

    try {
        const response = await fetch(url);
        if (!response.ok) return writeError(res, 400, `Failed to fetch trajectory from '${url}'.`, 'fetch-trajectory');
        const buffer = await response.buffer();
        const entry = createTrajectoryEntry(Config, { id, name, description, source, format: 'xtc', fileName }, buffer);
        res.status(201);
        res.json(entry);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to create trajectory entry.';
        const status = /already exists/i.test(message) ? 409 : 500;
        writeError(res, status, message, status === 409 ? 'unique-trajectory' : 'create-trajectory');
    }
});

app.get(mapPath(`${ApiRoot}/:id`), (req, res) => {
    let id: string;
    try {
        id = normalizeTrajectoryId(req.params.id || '');
    } catch (e) {
        return writeError(res, 400, e instanceof Error ? e.message : 'Invalid trajectory id.', 'valid-id');
    }
    const entry = getTrajectoryEntry(Config, id);
    if (!entry) return writeError(res, 404, `Trajectory '${id}' does not exist.`, 'missing-trajectory');
    const content = readTrajectoryFile(Config, id);
    if (content === void 0) return writeError(res, 404, `Trajectory '${id}' does not exist.`, 'missing-trajectory');
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    res.end(content);
});

app.put(mapPath(`${ApiRoot}/:id`), (req, res) => {
    let id: string;
    let fileName: string;
    try {
        id = normalizeTrajectoryId(req.params.id || '');
        fileName = normalizeXtcFileName((req.query.fileName as string | undefined) || `${id}.xtc`);
    } catch (e) {
        return writeError(res, 400, e instanceof Error ? e.message : 'Invalid trajectory upload.', 'valid-trajectory');
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return writeError(res, 400, 'Request body must contain XTC binary data.', 'request-body');

    try {
        const entry = createTrajectoryEntry(Config, {
            id,
            fileName,
            name: (req.query.name as string | undefined) || id,
            description: (req.query.description as string | undefined) || '',
            source: (req.query.source as string | undefined) || 'direct-upload',
            format: 'xtc'
        }, req.body);
        res.status(201);
        res.json(entry);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to store trajectory upload.';
        const status = /already exists/i.test(message) ? 409 : 500;
        writeError(res, status, message, status === 409 ? 'unique-trajectory' : 'create-trajectory');
    }
});

app.delete(mapPath(`${ApiRoot}/:id`), (req, res) => {
    let id: string;
    try {
        id = normalizeTrajectoryId(req.params.id || '');
    } catch (e) {
        return writeError(res, 400, e instanceof Error ? e.message : 'Invalid trajectory id.', 'valid-id');
    }
    if (!removeTrajectoryEntry(Config, id)) return writeError(res, 404, `Trajectory '${id}' does not exist.`, 'missing-trajectory');
    res.status(200);
    res.end();
});

app.get(mapPath(`${ApiRoot}/:id/starts`), async (req, res) => {
    const id = parseTrajectoryId(req.params.id || '', res);
    if (!id) return;
    const filePath = await resolveTrajectoryFilePath(id, res);
    if (!filePath) return;
    try {
        const starts = await getFrameStarts(filePath);
        res.write(`${starts}`);
        res.end();
    } catch {
        return writeError(res, 404, `Trajectory '${id}' could not be streamed.`, 'stream-trajectory');
    }
});

app.get(mapPath(`${ApiRoot}/:id/frame/offset/:start/:end`), async (req, res) => {
    const id = parseTrajectoryId(req.params.id || '', res);
    if (!id) return;
    const filePath = await resolveTrajectoryFilePath(id, res);
    if (!filePath) return;
    const start = parseFramePosition(req.params.start || '', 'start', res);
    if (start === void 0) return;
    const end = parseFramePosition(req.params.end || '', 'end', res);
    if (end === void 0) return;
    return sendSingleFrame(filePath, start, end, res);
});

app.get(mapPath(`${ApiRoot}/:id/frame/start/:start`), async (req, res) => {
    const id = parseTrajectoryId(req.params.id || '', res);
    if (!id) return;
    const filePath = await resolveTrajectoryFilePath(id, res);
    if (!filePath) return;
    const start = parseFramePosition(req.params.start || '', 'start', res);
    if (start === void 0) return;

    try {
        const starts = await getFrameStarts(filePath);
        const index = starts.indexOf(start);
        if (index < 0) return writeError(res, 404, `Frame start '${start}' does not exist.`, 'missing-frame');
        const end = index === starts.length - 1 ? Infinity : starts[index + 1];
        return sendSingleFrame(filePath, start, end, res);
    } catch {
        return writeError(res, 404, `Trajectory '${id}' could not be streamed.`, 'stream-trajectory');
    }
});

app.get(mapPath(`${ApiRoot}/:id/frame-range/offset/:start/:end`), async (req, res) => {
    const id = parseTrajectoryId(req.params.id || '', res);
    if (!id) return;
    const filePath = await resolveTrajectoryFilePath(id, res);
    if (!filePath) return;
    const start = parseFramePosition(req.params.start || '', 'start', res);
    if (start === void 0) return;
    const end = parseFramePosition(req.params.end || '', 'end', res);
    if (end === void 0) return;
    return sendFrameRange(filePath, start, end, res);
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
    title: 'Trajectory Registry API',
    shortcutIconLink
}));

ensureTrajectoryDataDirectory(Config);
app.listen(Config.port);

console.log('Mol* Trajectory Registry');
console.log('');
console.log(JSON.stringify(Config, null, 2));
