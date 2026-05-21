/**
 * Copyright (c) 2020-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 *
 * adapted from the original Mol* state server schema.
 */

import { VERSION } from "./version";
import { Config } from "./config";

export function getSchema(config: Config) {
  function mapPath(path: string) {
    return `${config.api_prefix}/${path}`;
  }

  return {
    openapi: "3.0.0",
    info: {
      version: VERSION,
      title: "MDsrv API",
      description: "Session and trajectory endpoints for the MDsrv server.",
    },
    tags: [{ name: "Session" }, { name: "Trajectory" }],
    paths: {
      [mapPath("api/v1/session")]: {
        get: {
          tags: ["Session"],
          summary: "Returns the list of stored sessions.",
          operationId: "listSessions",
          parameters: [],
          responses: {
            200: {
              description: "A list of stored sessions.",
              content: { "application/json": {} },
            },
          },
        },
        post: {
          tags: ["Session"],
          summary: "Uploads a Mol* Viewer session to the server.",
          operationId: "createSession",
          requestBody: {
            content: {
              "application/zip": {
                schema: { type: "object" },
              },
            },
          },
          parameters: [
            {
              name: "name",
              in: "query",
              description:
                "Name of the session. If none provided, current UTC date-time is used.",
              required: false,
              schema: { type: "string" },
              style: "simple",
            },
            {
              name: "description",
              in: "query",
              description: "Description of the session.",
              required: false,
              schema: { type: "string" },
              style: "simple",
            },
            {
              name: "version",
              in: "query",
              description:
                "Version of the used Mol* Build to upload the session.",
              required: true,
              schema: { type: "string" },
              style: "simple",
            },
          ],
          responses: {
            200: {
              description: "Empty response.",
              content: { "text/plain": {} },
            },
            400: {
              description: "Invalid session id.",
              content: { "application/json": {} },
            },
            403: {
              description: "Sticky session cannot be deleted.",
              content: { "application/json": {} },
            },
            404: {
              description: "Session not found.",
              content: { "application/json": {} },
            },
          },
        },
        patch: {
          tags: ["Session"],
          summary:
            "Updates session metadata and optionally renames its id/file.",
          operationId: "updateSession",
          parameters: [
            {
              name: "id",
              in: "path",
              description: "Current session id.",
              required: true,
              schema: { type: "string" },
              style: "simple",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      description:
                        "Optional new id. If provided, the .molx file is renamed.",
                    },
                    name: { type: "string", description: "Display name." },
                    description: { type: "string" },
                    source: { type: "string" },
                    version: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Session updated.",
              content: { "application/json": {} },
            },
            400: {
              description: "Invalid request.",
              content: { "application/json": {} },
            },
            403: {
              description: "Sticky session cannot be modified.",
              content: { "application/json": {} },
            },
            404: {
              description: "Session not found.",
              content: { "application/json": {} },
            },
            409: {
              description: "Target session id already exists.",
              content: { "application/json": {} },
            },
          },
        },
      },
      [mapPath("api/v1/session/{id}")]: {
        get: {
          tags: ["Session"],
          summary: "Returns the Mol* Viewer session with the given id.",
          operationId: "getSession",
          parameters: [
            {
              name: "id",
              in: "path",
              description: "Id of the session.",
              required: true,
              schema: { type: "string" },
              style: "simple",
            },
          ],
          responses: {
            200: {
              description: "Session as zip.",
              content: { "application/zip": {} },
            },
          },
        },
        delete: {
          tags: ["Session"],
          summary: "Removes the Mol* Viewer session with the given id.",
          operationId: "deleteSession",
          parameters: [
            {
              name: "id",
              in: "path",
              description: "Id of the session.",
              required: true,
              schema: { type: "string" },
              style: "simple",
            },
          ],
          responses: {
            200: {
              description: "Empty response.",
              content: { "text/plain": {} },
            },
          },
        },
      },
      [mapPath("api/v1/trajectory")]: {
        get: {
          tags: ["Trajectory"],
          summary: "Returns the list of stored trajectories.",
          operationId: "listTrajectories",
          parameters: [],
          responses: {
            200: {
              description: "A list of stored trajectories.",
              content: { "application/json": {} },
            },
          },
        },
        post: {
          tags: ["Trajectory"],
          summary: "Uploads a trajectory from a source URL.",
          operationId: "createTrajectory",
          requestBody: {
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
          parameters: [],
          responses: {
            200: {
              description: "Upload status.",
              content: { "text/plain": {} },
            },
          },
        },
      },
      [mapPath("api/v1/trajectory/{id}")]: {
        delete: {
          tags: ["Trajectory"],
          summary: "Removes the trajectory with the given id.",
          operationId: "deleteTrajectory",
          parameters: [
            {
              name: "id",
              in: "path",
              description: "Id of the trajectory.",
              required: true,
              schema: { type: "string" },
              style: "simple",
            },
          ],
          responses: {
            200: {
              description: "Empty response.",
              content: { "text/plain": {} },
            },
          },
        },
      },
      [mapPath("api/v1/trajectory/{id}/starts")]: {
        get: {
          tags: ["Trajectory"],
          summary:
            "Returns an array for the offset bits for all frame starts of the trajectory with the given id.",
          operationId: "getTrajectoryStarts",
          parameters: [
            {
              name: "id",
              in: "path",
              description: "Id of the trajectory.",
              required: true,
              schema: { type: "string" },
              style: "simple",
            },
          ],
          responses: {
            200: {
              description: "Array with frame starts.",
              content: { "text/plain": {} },
            },
          },
        },
      },
      [mapPath("api/v1/trajectory/{id}/frame/offset/{start}/{end}")]: {
        get: {
          tags: ["Trajectory"],
          summary:
            "Returns an XTCFile for a single frame of a trajectory with the given id.",
          operationId: "getTrajectoryFrame",
          parameters: [
            {
              name: "id",
              in: "path",
              description: "Id of the trajectory.",
              required: true,
              schema: { type: "string" },
              style: "simple",
            },
            {
              name: "start",
              in: "path",
              description: "Start bit for reading this frame.",
              required: true,
              schema: { type: "string" },
              style: "simple",
            },
            {
              name: "end",
              in: "path",
              description: "Start bit of next frame.",
              required: true,
              schema: { type: "string" },
              style: "simple",
            },
          ],
          responses: {
            200: {
              description: "XTCFile for the frame.",
              content: { "application/json": {} },
            },
          },
        },
      },
    },
  };
}

export const shortcutIconLink = `<link rel='shortcut icon' href='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAnUExURQAAAMIrHrspHr0oH7soILonHrwqH7onILsoHrsoH7soH7woILwpIKgVokoAAAAMdFJOUwAQHzNxWmBHS5XO6jdtAmoAAACZSURBVDjLxZNRCsQgDAVNXmwb9f7nXZEaLRgXloXOhwQdjMYYwpOLw55fBT46KhbOKhmRR2zLcFJQj8UR+HxFgArIF5BKJbEncC6NDEdI5SatBRSDJwGAoiFDONrEJXWYhGMIcRJGCrb1TOtDahfUuQXd10jkFYq0ViIrbUpNcVT6redeC1+b9tH2WLR93Sx2VCzkv/7NjfABxjQHksGB7lAAAAAASUVORK5CYII=' />`;
