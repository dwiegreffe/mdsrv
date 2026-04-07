import * as fs from 'fs';
import * as path from 'path';
import { load } from 'js-yaml';
import { makeDir } from '../../mol-util/make-dir';
import { Config } from './config';

export type YmlValidationConfig = {
    forbiddenWords: string[],
    forbiddenKeys: string[],
    requiredKeys: string[],
    maxFileSizeBytes?: number,
}

type YmlValidationContext = {
    operation: 'create' | 'update',
    name: string,
    content: string,
}

export type YmlValidationError = {
    rule: string,
    message: string,
}

const AllowedFileName = /^[A-Za-z0-9._-]+$/;

export function getYmlDataDirectory(config: Config) {
    return path.join(config.working_folder, 'files');
}

export function ensureYmlDataDirectory(config: Config) {
    if (!fs.existsSync(config.working_folder)) makeDir(config.working_folder);
    const dir = getYmlDataDirectory(config);
    if (!fs.existsSync(dir)) makeDir(dir);
}

export function normalizeYmlName(name: string) {
    const normalized = (name || '').trim();
    if (!normalized) throw new Error('File name must not be empty.');
    if (normalized.includes('/') || normalized.includes('\\') || normalized.includes('..')) throw new Error('File name must not contain path separators or parent directory segments.');
    if (!AllowedFileName.test(normalized)) throw new Error('File name may only contain letters, numbers, dot, underscore, and hyphen.');
    if (!normalized.endsWith('.yml') && !normalized.endsWith('.yaml')) throw new Error('File name must end with .yml or .yaml.');
    return normalized;
}

export function getYmlFilePath(config: Config, name: string) {
    return path.join(getYmlDataDirectory(config), normalizeYmlName(name));
}

export function listYmlFiles(config: Config) {
    const dir = getYmlDataDirectory(config);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(file => file.endsWith('.yml') || file.endsWith('.yaml')).sort((a, b) => a.localeCompare(b));
}

export function readYmlValidationConfig(config: Config): YmlValidationConfig {
    const defaults: YmlValidationConfig = { forbiddenWords: [], forbiddenKeys: [], requiredKeys: [] };
    if (!config.yml_rules) return defaults;
    const rulesPath = path.resolve(config.yml_rules);
    if (!fs.existsSync(rulesPath)) throw new Error(`YAML rule config file not found: ${rulesPath}`);
    const raw = JSON.parse(fs.readFileSync(rulesPath, 'utf-8')) as Partial<YmlValidationConfig>;
    return {
        forbiddenWords: raw.forbiddenWords ?? defaults.forbiddenWords,
        forbiddenKeys: raw.forbiddenKeys ?? defaults.forbiddenKeys,
        requiredKeys: raw.requiredKeys ?? defaults.requiredKeys,
        maxFileSizeBytes: raw.maxFileSizeBytes,
    };
}

function flattenKeys(value: unknown, keys: Set<string> = new Set<string>()) {
    if (Array.isArray(value)) {
        for (const item of value) flattenKeys(item, keys);
        return keys;
    }
    if (!value || typeof value !== 'object') return keys;
    for (const [key, nestedValue] of Object.entries(value)) {
        keys.add(key);
        flattenKeys(nestedValue, keys);
    }
    return keys;
}

function topLevelObject(value: unknown) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function validateYml(config: YmlValidationConfig, ctx: YmlValidationContext) {
    const errors: YmlValidationError[] = [];

    if (config.maxFileSizeBytes !== void 0 && Buffer.byteLength(ctx.content, 'utf-8') > config.maxFileSizeBytes) {
        errors.push({ rule: 'max-file-size', message: `File exceeds the maximum size of ${config.maxFileSizeBytes} bytes.` });
    }

    let parsed: unknown;
    try {
        parsed = load(ctx.content);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Invalid YAML document.';
        errors.push({ rule: 'parseable-yaml', message });
        return errors;
    }

    if (config.requiredKeys.length || config.forbiddenKeys.length) {
        if (!topLevelObject(parsed)) {
            errors.push({ rule: 'yaml-object', message: 'YAML document must contain an object at the top level to validate keys.' });
            return errors;
        }
        const keys = flattenKeys(parsed);
        for (const key of config.requiredKeys) {
            if (!keys.has(key)) errors.push({ rule: 'required-keys', message: `Missing required key '${key}'.` });
        }
        for (const key of config.forbiddenKeys) {
            if (keys.has(key)) errors.push({ rule: 'forbidden-keys', message: `YAML contains forbidden key '${key}'.` });
        }
    }

    for (const word of config.forbiddenWords) {
        if (word && ctx.content.includes(word)) errors.push({ rule: 'forbidden-words', message: `YAML contains forbidden word '${word}'.` });
    }
    return errors;
}
