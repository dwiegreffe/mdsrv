import { Config } from './config';
import { VERSION } from './version';

export function getSchema(config: Config) {
    function mapPath(path: string) {
        return `${config.api_prefix}/${path}`;
    }

    return {
        openapi: '3.0.0',
        info: {
            version: VERSION,
            title: 'YML Server',
            description: 'A simple service for storing and validating YAML files.'
        },
        tags: [{ name: 'General' }],
        paths: {
            [mapPath('yml')]: {
                get: {
                    tags: ['General'],
                    summary: 'Returns a JSON array of available YAML file names.',
                    operationId: 'listYml',
                    parameters: [],
                    responses: {
                        200: {
                            description: 'A list of YAML file names.',
                            content: { 'application/json': {} }
                        }
                    }
                }
            },
            [mapPath('yml/{name}')]: {
                get: {
                    tags: ['General'],
                    summary: 'Returns the YAML file content with the given file name.',
                    operationId: 'getYml',
                    parameters: [{ name: 'name', in: 'path', description: 'YAML file name including .yml or .yaml suffix.', required: true, schema: { type: 'string' }, style: 'simple' }],
                    responses: {
                        200: { description: 'The YAML file content.', content: { 'text/yaml': {} } }
                    }
                },
                put: {
                    tags: ['General'],
                    summary: 'Creates a new YAML file. Fails if the file already exists.',
                    operationId: 'createYml',
                    requestBody: {
                        content: {
                            'text/yaml': { schema: { type: 'string' } },
                            'application/x-yaml': { schema: { type: 'string' } },
                            'text/plain': { schema: { type: 'string' } }
                        }
                    },
                    parameters: [{ name: 'name', in: 'path', description: 'YAML file name including .yml or .yaml suffix.', required: true, schema: { type: 'string' }, style: 'simple' }],
                    responses: {
                        201: { description: 'File created.', content: { 'text/plain': {} } },
                        400: { description: 'Invalid filename or YAML validation failed.', content: { 'application/json': {} } },
                        409: { description: 'File already exists.', content: { 'application/json': {} } }
                    }
                },
                post: {
                    tags: ['General'],
                    summary: 'Updates an existing YAML file. Fails if the file does not exist.',
                    operationId: 'updateYml',
                    requestBody: {
                        content: {
                            'text/yaml': { schema: { type: 'string' } },
                            'application/x-yaml': { schema: { type: 'string' } },
                            'text/plain': { schema: { type: 'string' } }
                        }
                    },
                    parameters: [{ name: 'name', in: 'path', description: 'YAML file name including .yml or .yaml suffix.', required: true, schema: { type: 'string' }, style: 'simple' }],
                    responses: {
                        200: { description: 'File updated.', content: { 'text/plain': {} } },
                        400: { description: 'Invalid filename or YAML validation failed.', content: { 'application/json': {} } },
                        404: { description: 'File not found.', content: { 'application/json': {} } }
                    }
                },
                delete: {
                    tags: ['General'],
                    summary: 'Removes an existing YAML file.',
                    operationId: 'deleteYml',
                    parameters: [{ name: 'name', in: 'path', description: 'YAML file name including .yml or .yaml suffix.', required: true, schema: { type: 'string' }, style: 'simple' }],
                    responses: {
                        200: { description: 'File removed.', content: { 'text/plain': {} } },
                        404: { description: 'File not found.', content: { 'application/json': {} } }
                    }
                }
            },
            [mapPath('yml/{name}/rename')]: {
                post: {
                    tags: ['General'],
                    summary: 'Renames an existing YAML file.',
                    operationId: 'renameYml',
                    parameters: [
                        { name: 'name', in: 'path', description: 'Current YAML file name including .yml or .yaml suffix.', required: true, schema: { type: 'string' }, style: 'simple' },
                        { name: 'to', in: 'query', description: 'Target YAML file name including .yml or .yaml suffix.', required: true, schema: { type: 'string' }, style: 'simple' }
                    ],
                    responses: {
                        200: { description: 'File renamed.', content: { 'text/plain': {} } },
                        400: { description: 'Invalid source or target file name.', content: { 'application/json': {} } },
                        404: { description: 'Source file not found.', content: { 'application/json': {} } },
                        409: { description: 'Target file already exists.', content: { 'application/json': {} } }
                    }
                }
            }
        }
    };
}

export const shortcutIconLink = `<link rel='shortcut icon' href='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAnUExURQAAAMIrHrspHr0oH7soILonHrwqH7onILsoHrsoH7soH7woILwpIKgVokoAAAAMdFJOUwAQHzNxWmBHS5XO6jdtAmoAAACZSURBVDjLxZNRCsQgDAVNXmwb9f7nXZEaLRgXloXOhwQdjMYYwpOLw55fBT46KhbOKhmRR2zLcFJQj8UR+HxFgArIF5BKJbEncC6NDEdI5SatBRSDJwGAoiFDONrEJXWYhGMIcRJGCrb1TOtDahfUuQXd10jkFYq0ViIrbUpNcVT6redeC1+b9tH2WLR93Sx2VCzkv/7NjfABxjQHksGB7lAAAAAASUVORK5CYII=' />`;
