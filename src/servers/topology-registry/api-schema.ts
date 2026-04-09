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
            title: 'Topology Registry',
            description: 'A file-backed PDB topology registry for modular MDsrv deployments.'
        },
        tags: [{ name: 'Topology' }],
        paths: {
            [mapPath('api/v1/topology')]: {
                get: {
                    tags: ['Topology'],
                    summary: 'Returns a JSON array of stored PDB topology entries.',
                    operationId: 'listTopologies',
                    parameters: [],
                    responses: {
                        200: {
                            description: 'A list of topology entries.',
                            content: { 'application/json': {} }
                        }
                    }
                },
                post: {
                    tags: ['Topology'],
                    summary: 'Fetches a PDB file from a remote URL and stores it in the topology registry.',
                    operationId: 'createTopologyFromUrl',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['url', 'id', 'fileName'],
                                    properties: {
                                        url: { type: 'string' },
                                        id: { type: 'string' },
                                        fileName: { type: 'string' },
                                        name: { type: 'string' },
                                        description: { type: 'string' },
                                        source: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        201: { description: 'Topology created.', content: { 'application/json': {} } },
                        400: { description: 'Invalid request.', content: { 'application/json': {} } },
                        409: { description: 'Topology id or file name already exists.', content: { 'application/json': {} } }
                    }
                }
            },
            [mapPath('api/v1/topology/{id}')]: {
                put: {
                    tags: ['Topology'],
                    summary: 'Uploads a PDB file directly and stores it under the given topology id.',
                    operationId: 'uploadTopology',
                    parameters: [
                        { name: 'id', in: 'path', description: 'Topology id.', required: true, schema: { type: 'string' }, style: 'simple' },
                        { name: 'name', in: 'query', description: 'Display name.', required: false, schema: { type: 'string' } },
                        { name: 'description', in: 'query', description: 'Description.', required: false, schema: { type: 'string' } },
                        { name: 'source', in: 'query', description: 'Source label.', required: false, schema: { type: 'string' } },
                        { name: 'fileName', in: 'query', description: 'Stored file name. Must end with .pdb.', required: false, schema: { type: 'string' } }
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'chemical/x-pdb': { schema: { type: 'string' } },
                            'text/plain': { schema: { type: 'string' } }
                        }
                    },
                    responses: {
                        201: { description: 'Topology uploaded.', content: { 'application/json': {} } },
                        400: { description: 'Invalid request.', content: { 'application/json': {} } },
                        409: { description: 'Topology id or file name already exists.', content: { 'application/json': {} } },
                        413: { description: 'Upload exceeds configured limit.', content: { 'application/json': {} } }
                    }
                },
                get: {
                    tags: ['Topology'],
                    summary: 'Returns the stored PDB file content for the given topology id.',
                    operationId: 'getTopology',
                    parameters: [{ name: 'id', in: 'path', description: 'Topology id.', required: true, schema: { type: 'string' }, style: 'simple' }],
                    responses: {
                        200: { description: 'The PDB file content.', content: { 'chemical/x-pdb': {} } },
                        404: { description: 'Topology not found.', content: { 'application/json': {} } }
                    }
                },
                delete: {
                    tags: ['Topology'],
                    summary: 'Removes a stored topology entry and its PDB file.',
                    operationId: 'deleteTopology',
                    parameters: [{ name: 'id', in: 'path', description: 'Topology id.', required: true, schema: { type: 'string' }, style: 'simple' }],
                    responses: {
                        200: { description: 'Topology removed.', content: { 'text/plain': {} } },
                        404: { description: 'Topology not found.', content: { 'application/json': {} } }
                    }
                }
            }
        }
    };
}

export const shortcutIconLink = `<link rel='shortcut icon' href='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAnUExURQAAAMIrHrspHr0oH7soILonHrwqH7onILsoHrsoH7soH7woILwpIKgVokoAAAAMdFJOUwAQHzNxWmBHS5XO6jdtAmoAAACZSURBVDjLxZNRCsQgDAVNXmwb9f7nXZEaLRgXloXOhwQdjMYYwpOLw55fBT46KhbOKhmRR2zLcFJQj8UR+HxFgArIF5BKJbEncC6NDEdI5SatBRSDJwGAoiFDONrEJXWYhGMIcRJGCrb1TOtDahfUuQXd10jkFYq0ViIrbUpNcVT6redeC1+b9tH2WLR93Sx2VCzkv/7NjfABxjQHksGB7lAAAAAASUVORK5CYII=' />`;
