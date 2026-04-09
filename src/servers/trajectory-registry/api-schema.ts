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
            title: 'Trajectory Registry',
            description: 'A file-backed XTC trajectory registry and streaming service for modular MDsrv deployments.'
        },
        tags: [{ name: 'Trajectory' }],
        paths: {
            [mapPath('api/v1/trajectory')]: {
                get: {
                    tags: ['Trajectory'],
                    summary: 'Returns the list of stored trajectories.',
                    operationId: 'listTrajectories',
                    parameters: [],
                    responses: {
                        200: { description: 'A list of stored trajectories.', content: { 'application/json': {} } }
                    }
                },
                post: {
                    tags: ['Trajectory'],
                    summary: 'Fetches an XTC trajectory from a source URL and stores it locally.',
                    operationId: 'createTrajectory',
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['url', 'id'],
                                    properties: {
                                        url: { type: 'string' },
                                        id: { type: 'string' },
                                        name: { type: 'string' },
                                        description: { type: 'string' },
                                        source: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        201: { description: 'Trajectory created.', content: { 'application/json': {} } },
                        400: { description: 'Invalid request.', content: { 'application/json': {} } },
                        409: { description: 'Trajectory id already exists.', content: { 'application/json': {} } }
                    }
                }
            },
            [mapPath('api/v1/trajectory/{id}')]: {
                delete: {
                    tags: ['Trajectory'],
                    summary: 'Removes the trajectory with the given id.',
                    operationId: 'deleteTrajectory',
                    parameters: [{ name: 'id', in: 'path', description: 'Trajectory id.', required: true, schema: { type: 'string' }, style: 'simple' }],
                    responses: {
                        200: { description: 'Trajectory removed.', content: { 'text/plain': {} } },
                        404: { description: 'Trajectory not found.', content: { 'application/json': {} } }
                    }
                }
            },
            [mapPath('api/v1/trajectory/{id}/starts')]: {
                get: {
                    tags: ['Trajectory'],
                    summary: 'Returns the frame start offsets for an XTC trajectory.',
                    operationId: 'getTrajectoryStarts',
                    parameters: [{ name: 'id', in: 'path', description: 'Trajectory id.', required: true, schema: { type: 'string' }, style: 'simple' }],
                    responses: {
                        200: { description: 'Frame starts.', content: { 'text/plain': {} } },
                        404: { description: 'Trajectory not found.', content: { 'application/json': {} } }
                    }
                }
            },
            [mapPath('api/v1/trajectory/{id}/frame/offset/{start}/{end}')]: {
                get: {
                    tags: ['Trajectory'],
                    summary: 'Returns an XTC frame payload for a single frame offset range.',
                    operationId: 'getTrajectoryFrame',
                    parameters: [
                        { name: 'id', in: 'path', description: 'Trajectory id.', required: true, schema: { type: 'string' }, style: 'simple' },
                        { name: 'start', in: 'path', description: 'Frame start offset.', required: true, schema: { type: 'string' }, style: 'simple' },
                        { name: 'end', in: 'path', description: 'Frame end offset or Infinity.', required: true, schema: { type: 'string' }, style: 'simple' }
                    ],
                    responses: {
                        200: { description: 'Frame payload.', content: { 'application/json': {} } },
                        404: { description: 'Trajectory or frame range not found.', content: { 'application/json': {} } }
                    }
                }
            }
        }
    };
}

export const shortcutIconLink = `<link rel='shortcut icon' href='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAnUExURQAAAMIrHrspHr0oH7soILonHrwqH7onILsoHrsoH7soH7woILwpIKgVokoAAAAMdFJOUwAQHzNxWmBHS5XO6jdtAmoAAACZSURBVDjLxZNRCsQgDAVNXmwb9f7nXZEaLRgXloXOhwQdjMYYwpOLw55fBT46KhbOKhmRR2zLcFJQj8UR+HxFgArIF5BKJbEncC6NDEdI5SatBRSDJwGAoiFDONrEJXWYhGMIcRJGCrb1TOtDahfUuQXd10jkFYq0ViIrbUpNcVT6redeC1+b9tH2WLR93Sx2VCzkv/7NjfABxjQHksGB7lAAAAAASUVORK5CYII=' />`;
