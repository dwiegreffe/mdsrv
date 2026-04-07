import express from 'express';
import compression from 'compression';
import cors from 'cors';
import * as bodyParser from 'body-parser';
import * as fs from 'fs';
import { swaggerUiAssetsHandler, swaggerUiIndexHandler } from '../common/swagger-ui';
import { getConfig } from './config';
import { ensureYmlDataDirectory, getYmlFilePath, listYmlFiles, normalizeYmlName, readYmlValidationConfig, validateYml } from './yml';
import { getSchema, shortcutIconLink } from './api-schema';

const Config = getConfig();
const YmlValidationConfig = readYmlValidationConfig(Config);

const app = express();
app.use(compression(<any>{ level: 6, memLevel: 9, chunkSize: 16 * 16384, filter: () => true }));
app.use(cors({ methods: ['GET', 'PUT', 'POST', 'DELETE'] }));
app.use(bodyParser.text({ type: ['text/yaml', 'application/x-yaml', 'text/plain'], limit: '1mb' }));

function mapPath(path: string) {
    if (!Config.api_prefix) return path;
    return `/${Config.api_prefix}/${path}`;
}

function writeError(res: express.Response, status: number, message: string, rule?: string) {
    res.status(status);
    res.json({ errors: [{ rule: rule || 'request', message }] });
}

app.get(mapPath('/yml'), (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(listYmlFiles(Config)));
});

app.get(mapPath('/yml/:name'), (req, res) => {
    let name: string;
    try {
        name = normalizeYmlName(req.params.name || '');
    } catch (e) {
        return writeError(res, 400, e instanceof Error ? e.message : 'Invalid file name.', 'valid-filename');
    }
    fs.readFile(getYmlFilePath(Config, name), 'utf-8', (err, data) => {
        if (err) {
            res.status(404);
            res.end();
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/yaml; charset=utf-8' });
        res.end(data);
    });
});

app.put(mapPath('/yml/:name'), (req, res) => {
    let name: string;
    try {
        name = normalizeYmlName(req.params.name || '');
    } catch (e) {
        return writeError(res, 400, e instanceof Error ? e.message : 'Invalid file name.', 'valid-filename');
    }
    if (typeof req.body !== 'string') return writeError(res, 400, 'Request body must contain YAML text.', 'request-body');
    const filePath = getYmlFilePath(Config, name);
    if (fs.existsSync(filePath)) return writeError(res, 409, `File '${name}' already exists.`, 'unique-name');
    const errors = validateYml(YmlValidationConfig, { operation: 'create', name, content: req.body });
    if (errors.length) {
        res.status(400);
        res.json({ errors });
        return;
    }
    fs.writeFile(filePath, req.body, { encoding: 'utf8' }, err => {
        if (err) return writeError(res, 500, 'Failed to write YAML file.', 'fs-write');
        res.status(201);
        res.end();
    });
});

app.post(mapPath('/yml/:name'), (req, res) => {
    let name: string;
    try {
        name = normalizeYmlName(req.params.name || '');
    } catch (e) {
        return writeError(res, 400, e instanceof Error ? e.message : 'Invalid file name.', 'valid-filename');
    }
    if (typeof req.body !== 'string') return writeError(res, 400, 'Request body must contain YAML text.', 'request-body');
    const filePath = getYmlFilePath(Config, name);
    if (!fs.existsSync(filePath)) return writeError(res, 404, `File '${name}' does not exist.`, 'missing-file');
    const errors = validateYml(YmlValidationConfig, { operation: 'update', name, content: req.body });
    if (errors.length) {
        res.status(400);
        res.json({ errors });
        return;
    }
    fs.writeFile(filePath, req.body, { encoding: 'utf8' }, err => {
        if (err) return writeError(res, 500, 'Failed to update YAML file.', 'fs-write');
        res.status(200);
        res.end();
    });
});

app.post(mapPath('/yml/:name/rename'), (req, res) => {
    let sourceName: string;
    let targetName: string;
    try {
        sourceName = normalizeYmlName(req.params.name || '');
        targetName = normalizeYmlName(req.query.to as string || '');
    } catch (e) {
        return writeError(res, 400, e instanceof Error ? e.message : 'Invalid file name.', 'valid-filename');
    }
    if (sourceName === targetName) return writeError(res, 400, 'Source and target names must differ.', 'rename-target');
    const sourcePath = getYmlFilePath(Config, sourceName);
    const targetPath = getYmlFilePath(Config, targetName);
    if (!fs.existsSync(sourcePath)) return writeError(res, 404, `File '${sourceName}' does not exist.`, 'missing-file');
    if (fs.existsSync(targetPath)) return writeError(res, 409, `File '${targetName}' already exists.`, 'unique-name');
    fs.rename(sourcePath, targetPath, err => {
        if (err) return writeError(res, 500, 'Failed to rename YAML file.', 'fs-rename');
        res.status(200);
        res.end();
    });
});

app.delete(mapPath('/yml/:name'), (req, res) => {
    let name: string;
    try {
        name = normalizeYmlName(req.params.name || '');
    } catch (e) {
        return writeError(res, 400, e instanceof Error ? e.message : 'Invalid file name.', 'valid-filename');
    }
    const filePath = getYmlFilePath(Config, name);
    if (!fs.existsSync(filePath)) return writeError(res, 404, `File '${name}' does not exist.`, 'missing-file');
    fs.unlink(filePath, err => {
        if (err) return writeError(res, 500, 'Failed to remove YAML file.', 'fs-remove');
        res.status(200);
        res.end();
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
    title: 'YML Server API',
    shortcutIconLink
}));

ensureYmlDataDirectory(Config);
app.listen(Config.port);

console.log('Mol* YML Server');
console.log('');
console.log(JSON.stringify(Config, null, 2));
