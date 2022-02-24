/**
 * Copyright (c) 2020-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 *
 * adapted from /src/servers/plugin-state/api-schema.ts
 */

import { VERSION } from './version';
import { Config } from './config';

export function getSchema(config: Config) {
    function mapPath(path: string) {
        return `${config.api_prefix}/${path}`;
    }

    return {
        openapi: '3.0.0',
        info: {
            version: VERSION,
            title: 'PluginSession Server',
            description: 'The PluginSession Server is a simple service for storing and retreiving sessions of the Mol* Viewer app.',
        },
        tags: [
            {
                name: 'General',
            }
        ],
        paths: {
            [mapPath(`list/{type}`)]: {
                get: {
                    tags: ['General'],
                    summary: 'Returns a JSON response with the list of currently stored sessions',
                    operationId: 'list',
                    parameters: [
                        {
                            name: 'type',
                            in: 'path',
                            description: 'List type (session | trajectory).',
                            requires: true,
                            schema: { type: 'string ' },
                            style: 'simple'
                        }
                    ],
                    responses: {
                        200: {
                            description: 'A list of stored sessions or trajectories.',
                            content: {
                                'application/json': { }
                            }
                        }
                    },
                }
            },
            [mapPath(`get/session/{id}`)]: {
                get: {
                    tags: ['General'],
                    summary: 'Returns the Mol* Viewer session with the given id',
                    operationId: 'get',
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            description: `Id of the session.`,
                            required: true,
                            schema: { type: 'string' },
                            style: 'simple'
                        },
                    ],
                    responses: {
                        200: {
                            description: 'Session as zip.',
                            content: {
                                'application/zip': { }
                            }
                        }
                    },
                }
            },
            [mapPath(`remove/session/{id}`)]: {
                get: {
                    tags: ['General'],
                    summary: 'Removes the Mol* Viewer session with the given id.',
                    operationId: 'remove',
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            description: `Id of the session.`,
                            required: true,
                            schema: { type: 'string' },
                            style: 'simple'
                        }
                    ],
                    responses: {
                        200: {
                            description: 'Empty response.',
                            content: { 'text/plain': { } }
                        }
                    },
                }
            },
            [mapPath(`set/session`)]: {
                post: {
                    tags: ['General'],
                    summary: `Post Mol* Viewer session to the server.`,
                    operationId: 'set',
                    requestBody: {
                        content: {
                            'application/zip': {
                                schema: { type: 'object' }
                            }
                        }
                    },
                    parameters: [
                        {
                            name: 'name',
                            in: 'query',
                            description: `Name of the session. If none provided, current UTC date-time is used.`,
                            required: false,
                            schema: { type: 'string' },
                            style: 'simple'
                        },
                        {
                            name: 'description',
                            in: 'query',
                            description: `Description of the session.`,
                            required: false,
                            schema: { type: 'string' },
                            style: 'simple'
                        },
                        {
                            name: 'version',
                            in: 'query',
                            description: 'Version of the used Mol* Build to upload the session.',
                            required: true,
                            schema: { type: 'string' },
                            style: 'simple'
                        }
                    ],
                    responses: {
                        200: {
                            description: 'Empty response.',
                            content: { 'text/plain': { } }
                        }
                    },
                }
            },
            [mapPath(`get/trajectory/{id}/starts`)]: {
                get: {
                    tags: ['General'],
                    summary: 'Returns an array for the offset bits for all frame starts of the trajectory with the given id.',
                    operationId: 'get',
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            description: `Id of the trajectory.`,
                            required: true,
                            schema: { type: 'string' },
                            style: 'simple'
                        }
                    ],
                    responses: {
                        200: {
                            description: 'Array with frame starts.',
                            content: { 'text/plain': { } }
                        }
                    },
                }
            },
            [mapPath(`get/trajectory/{id}/frame/offset/{start}/{end}`)]: {
                get: {
                    tags: ['General'],
                    summary: 'Returns an XTCFile for a single frame of a trajectory with the given id.',
                    operationId: 'get',
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            description: `Id of the trajectory.`,
                            required: true,
                            schema: { type: 'string' },
                            style: 'simple'
                        },
                        {
                            name: 'start',
                            in: 'path',
                            description: `Start bit for reading this frame.`,
                            required: true,
                            schema: { type: 'string' },
                            style: 'simple'
                        },
                        {
                            name: 'end',
                            in: 'path',
                            description: `Start bit of next frame.`,
                            required: true,
                            schema: { type: 'string' },
                            style: 'simple'
                        }
                    ],
                    responses: {
                        200: {
                            description: 'XTCFile for the frame.',
                            content: { 'application/json': { } }
                        }
                    },
                }
            },
        }
    };
}

export const shortcutIconLink = `<link rel='shortcut icon' href='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAnUExURQAAAMIrHrspHr0oH7soILonHrwqH7onILsoHrsoH7soH7woILwpIKgVokoAAAAMdFJOUwAQHzNxWmBHS5XO6jdtAmoAAACZSURBVDjLxZNRCsQgDAVNXmwb9f7nXZEaLRgXloXOhwQdjMYYwpOLw55fBT46KhbOKhmRR2zLcFJQj8UR+HxFgArIF5BKJbEncC6NDEdI5SatBRSDJwGAoiFDONrEJXWYhGMIcRJGCrb1TOtDahfUuQXd10jkFYq0ViIrbUpNcVT6redeC1+b9tH2WLR93Sx2VCzkv/7NjfABxjQHksGB7lAAAAAASUVORK5CYII=' />`;