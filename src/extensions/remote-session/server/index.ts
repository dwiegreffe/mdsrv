/**
 * Copyright (c) 2019-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Michelle Kampfrath <kampfrath@informatik.uni-leipzig.de>
 *
 * parts adapted from /src/servers/plugin-state/index.ts
 */

import express from "express";
import compression from "compression";
import cors from "cors";
import * as bodyParser from "body-parser";
import * as fs from "fs";
import * as path from "path";
import fetch from "node-fetch";
import { swaggerUiIndexHandler, swaggerUiAssetsHandler } from "./swagger-ui";
import { makeDir } from "./helper/make-dir";
import { getConfig } from "./config";
import { UUID } from "./helper/uuid";
import { shortcutIconLink, getSchema } from "./api-schema";
import { getData, getFrameData } from "./helper/helper";
import { rejects } from "assert";

const Config = getConfig();
const ApiRoot = "/api/v1";

const app = express();
app.use(
  compression(<any>{
    level: 6,
    memLevel: 9,
    chunkSize: 16 * 16384,
    filter: () => true,
  }),
);
app.use(cors({ methods: ["GET", "PUT", "POST", "PATCH", "DELETE"] }));
app.use(
  bodyParser.raw({ inflate: true, type: "application/zip", limit: "1gb" }),
);
app.use(bodyParser.json({ limit: "1mb" }));

type Entry = {
  timestamp: number;
  id: string;
  name: string;
  description: string;
  source: string;
};

type SessionEntry = Entry & { version: string; isSticky?: boolean };
type SessionIndex = SessionEntry[];

type TrajectoryEntry = Entry;
type TrajectoryIndex = TrajectoryEntry[];

type Index = SessionIndex | TrajectoryIndex | [];

const AllowedId = /^[A-Za-z0-9._-]+$/;

function createIndex(name: string) {
  const fn = path.join(Config.working_folder, `${name}_index.json`);
  if (fs.existsSync(fn)) return;
  if (!fs.existsSync(Config.working_folder)) makeDir(Config.working_folder);
  if (!fs.existsSync(`${Config.working_folder}/${name}`))
    makeDir(`${Config.working_folder}/${name}`);
  fs.writeFileSync(fn, "[]", "utf-8");
}

function writeIndex(name: string, index: Index) {
  const fn = path.join(Config.working_folder, `${name}_index.json`);
  if (!fs.existsSync(Config.working_folder)) makeDir(Config.working_folder);
  fs.writeFileSync(fn, JSON.stringify(index, null, 2), "utf-8");
}

function readIndex(name: string): Index {
  const fn = path.join(Config.working_folder, `${name}_index.json`);
  if (!fs.existsSync(fn)) return [];
  switch (name) {
    case "session":
      return JSON.parse(fs.readFileSync(fn, "utf-8")) as SessionIndex;
    case "trajectory":
      return JSON.parse(fs.readFileSync(fn, "utf-8")) as TrajectoryIndex;
    default:
      return [];
  }
}

function mapPath(path: string) {
  if (!Config.api_prefix) return path;
  return `/${Config.api_prefix}/${path}`;
}

function writeError(
  res: express.Response,
  status: number,
  message: string,
  code?: string,
) {
  res.status(status);
  res.json({ errors: [{ code: code || "request", message }] });
}

function normalizeSessionId(id: string) {
  const normalized = (id || "").trim();
  if (!normalized) throw new Error("Session id must not be empty.");
  if (
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes("..")
  )
    throw new Error(
      "Session id must not contain path separators or parent directory segments.",
    );
  if (!AllowedId.test(normalized))
    throw new Error(
      "Session id may only contain letters, numbers, dot, underscore, and hyphen.",
    );
  return normalized;
}

// SESSION

function removeSession(id: string) {
  const index = readIndex("session") as SessionIndex;
  let i = 0;
  for (const e of index) {
    if (e.id !== id) {
      i++;
      continue;
    }
    if (e.isSticky) return "sticky" as const;
    try {
      for (let j = i + 1; j < index.length; j++) {
        index[j - 1] = index[j];
      }
      index.pop();
      writeIndex("session", index);
    } catch {}
    try {
      fs.unlinkSync(
        path.join(`${Config.working_folder}/session`, `${e.id}.molx`),
      );
    } catch {}
    return "removed" as const;
  }
  return "missing" as const;
}

type UpdateSessionParams = {
  id?: string;
  name?: string;
  description?: string;
  source?: string;
  version?: string;
};

function updateSession(id: string, updates: UpdateSessionParams) {
  const normalized = normalizeSessionId(id);
  const index = readIndex("session") as SessionIndex;
  const entryIndex = index.findIndex((e) => e.id === normalized);
  if (entryIndex < 0) return void 0;

  const entry = index[entryIndex];
  if (entry.isSticky)
    throw new Error(
      `Session '${normalized}' is sticky and cannot be modified.`,
    );

  const nextId =
    updates.id === void 0 ? entry.id : normalizeSessionId(updates.id);
  if (nextId !== entry.id && index.some((existing) => existing.id === nextId))
    throw new Error(`Session '${nextId}' already exists.`);

  if (nextId !== entry.id) {
    fs.renameSync(
      path.join(`${Config.working_folder}/session`, `${entry.id}.molx`),
      path.join(`${Config.working_folder}/session`, `${nextId}.molx`),
    );
  }

  const updatedEntry: SessionEntry = {
    ...entry,
    id: nextId,
    name: updates.name === void 0 ? entry.name : updates.name,
    description:
      updates.description === void 0 ? entry.description : updates.description,
    source: updates.source === void 0 ? entry.source : updates.source,
    version: updates.version === void 0 ? entry.version : updates.version,
  };

  index[entryIndex] = updatedEntry;
  writeIndex("session", index);
  return updatedEntry;
}

function removeTrajectory(id: string) {
  const index = readIndex("trajectory") as TrajectoryIndex;
  let i = 0;
  for (const e of index) {
    if (e.id !== id) {
      i++;
      continue;
    }
    try {
      for (let j = i + 1; j < index.length; j++) {
        index[j - 1] = index[j];
      }
      index.pop();
      writeIndex("trajectory", index);
    } catch {}
    try {
      fs.unlinkSync(
        path.join(`${Config.working_folder}/trajectory`, `${e.id}.xtc`),
      );
    } catch {}
    return;
  }
}

function sendIndex(res: express.Response, type: "session" | "trajectory") {
  const index = readIndex(type);
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.write(JSON.stringify(index, null, 2));
  res.end();
}

function sendSession(id: string, res: express.Response) {
  try {
    id = normalizeSessionId(id);
  } catch {
    res.status(404);
    res.end();
    return;
  }

  fs.readFile(
    path.join(`${Config.working_folder}/session`, `${id}.molx`),
    (err, data) => {
      if (err) {
        console.log(err);
        res.status(404);
        res.end();
        return;
      }

      res.writeHead(200, {
        "Content-Type": "application/zip",
      });
      res.write(data);
      res.end();
    },
  );
}

function sendTrajectoryStarts(id: string, res: express.Response) {
  const p = path.join(`${Config.working_folder}/trajectory`, `${id}.xtc`);

  getData(p)
    .then((value) => {
      res.write(`${value}`);
      res.end();
    })
    .catch((error) => {
      console.log(error);
      res.status(404);
      res.end();
    });
}

function sendTrajectoryFrame(
  id: string,
  tmpStart: string,
  tmpEnd: string,
  res: express.Response,
) {
  let start: number = -1;
  let end: number = -1;

  try {
    start = parseInt(tmpStart);
    end = tmpEnd === "Infinity" ? Infinity : parseInt(tmpEnd);
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

  getFrameData(p, start, end)
    .then((file) => {
      res.json(file);
      res.end();
    })
    .catch((error) => {
      console.log(error);
      res.status(404);
      res.end();
    });
}

function storeSession(
  blob: Buffer,
  name: string,
  description: string,
  source: string,
  version: string,
  res: express.Response,
) {
  const index = readIndex("session") as SessionIndex;
  index.push({
    timestamp: +new Date(),
    id: UUID.createv4(),
    name,
    description,
    source,
    version,
  });
  const entry = index[index.length - 1] as SessionEntry;

  fs.writeFile(
    path.join(`${Config.working_folder}/session`, `${entry.id}.molx`),
    blob,
    () => res.end(),
  );
  writeIndex("session", index);
}

function uploadTrajectory(
  url: string,
  name: string,
  description: string,
  source: string,
  res: express.Response,
) {
  const index = readIndex("trajectory") as TrajectoryIndex;
  const fn = `${Config.working_folder}/trajectory/${name}.xtc`;

  if (fs.existsSync(fn)) {
    res.status(409);
    res.write("File name already exists. Pick different file name.");
    res.end();
    return;
  }

  const writeableStream = fs.createWriteStream(fn);

  fetch(url)
    .then((response) => {
      if (response.status === 404) {
        throw new Error(`${response.status} file not found (URL)`);
      }
      return response.body;
    })
    .then((body) => {
      console.log(body.readable);

      body.on("data", (chunk: Buffer) => {
        writeableStream.write(chunk);
      });

      body.on("end", () => {
        index.push({
          timestamp: +new Date(),
          id: name,
          name,
          description,
          source,
        });
        writeIndex("trajectory", index);
        console.log(`Trajectory ${name}.xtc uploaded`);
        res.write("Trajectory uploaded.");
        res.end();
      });

      body.on("error", (error) => {
        rejects(error);
        res.end();
      });
    })
    .catch((error) => {
      console.log("Error while fetching:");
      console.log(error);
      fs.unlinkSync(fn);
      res.status(400);
      res.write(`${error}`);
      res.end();
    });
}

app.get(mapPath(`/get/session/:id/`), (req, res) => {
  const id: string = req.params.id || "";
  console.log("READING SESSION", id);
  sendSession(id, res);
});

app.get(mapPath(`/remove/session/:id`), (req, res) => {
  removeSession(((req.params.id as string) || "").toLowerCase());
  res.status(200);
  res.end();
});

app.get(mapPath(`/list/:type`), (req, res) => {
  const type = req.params.type === "trajectory" ? "trajectory" : "session";
  sendIndex(res, type);
});

app.post(mapPath("/set/session"), (req, res) => {
  console.log(
    "SET SESSION",
    req.query.name,
    req.query.description,
    req.query.version,
  );
  const blob = req.body;

  const name = ((req.query.name as string) || new Date().toUTCString()).substr(
    0,
    50,
  );
  const description = (req.query.description as string) || "";
  const source = (req.query.source as string) || "";
  const version = req.query.version as string;

  storeSession(blob, name, description, source, version, res);
});

// TRAJECTORY

app.get(
  mapPath(`/upload/trajectory/:url/:name/:description/:source`),
  (req, res) => {
    console.log(
      "UPLOAD TRAJECTORY",
      req.params.url,
      req.params.name,
      req.params.description,
    );

    const url: string = req.params.url;
    const name = (req.params.name as string) || new Date().toUTCString();
    const description = (req.params.description as string) || "";
    const source = (req.params.source as string) || "";

    uploadTrajectory(url, name, description, source, res);
  },
);

app.get(`${ApiRoot}/session`, (req, res) => sendIndex(res, "session"));
app.get(`${ApiRoot}/trajectory`, (req, res) => sendIndex(res, "trajectory"));

app.get(`${ApiRoot}/session/:id`, (req, res) => {
  sendSession(req.params.id || "", res);
});

app.delete(`${ApiRoot}/session/:id`, (req, res) => {
  let id: string;
  try {
    id = normalizeSessionId((req.params.id as string) || "");
  } catch (e) {
    return writeError(
      res,
      400,
      e instanceof Error ? e.message : "Invalid session id.",
      "valid-id",
    );
  }

  const result = removeSession(id);
  if (result === "missing")
    return writeError(
      res,
      404,
      `Session '${id}' does not exist.`,
      "missing-session",
    );
  if (result === "sticky")
    return writeError(
      res,
      403,
      `Session '${id}' is sticky and cannot be deleted.`,
      "sticky-session",
    );
  res.status(200);
  res.end();
});

app.patch(`${ApiRoot}/session/:id`, (req, res) => {
  try {
    const entry = updateSession((req.params.id as string) || "", {
      id: req.body?.id as string | undefined,
      name: req.body?.name as string | undefined,
      description: req.body?.description as string | undefined,
      source: req.body?.source as string | undefined,
      version: req.body?.version as string | undefined,
    });
    if (!entry)
      return writeError(
        res,
        404,
        `Session '${req.params.id}' does not exist.`,
        "missing-session",
      );
    res.json(entry);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to update session.";
    if (/sticky/i.test(message))
      return writeError(res, 403, message, "sticky-session");
    const status = /already exists/i.test(message)
      ? 409
      : /must|may only|separator|segment/i.test(message)
        ? 400
        : 500;
    writeError(
      res,
      status,
      message,
      status === 409 ? "unique-session" : "update-session",
    );
  }
});

app.post(`${ApiRoot}/session`, (req, res) => {
  const blob = req.body;
  const name = ((req.query.name as string) || new Date().toUTCString()).substr(
    0,
    50,
  );
  const description = (req.query.description as string) || "";
  const source = (req.query.source as string) || "";
  const version = req.query.version as string;
  storeSession(blob, name, description, source, version, res);
});

app.post(`${ApiRoot}/trajectory`, (req, res) => {
  const url = req.body?.url as string;
  const name = (req.body?.name as string) || new Date().toUTCString();
  const description = (req.body?.description as string) || "";
  const source = (req.body?.source as string) || "";
  if (!url) {
    res.status(400);
    res.json({
      errors: [
        {
          code: "missing_url",
          message: "Trajectory upload requires a source URL.",
        },
      ],
    });
    return;
  }
  uploadTrajectory(url, name, description, source, res);
});

app.delete(`${ApiRoot}/trajectory/:id`, (req, res) => {
  removeTrajectory((req.params.id as string) || "");
  res.status(200);
  res.end();
});

app.get(`${ApiRoot}/trajectory/:id/starts`, (req, res) => {
  sendTrajectoryStarts(req.params.id || "", res);
});

app.get(`${ApiRoot}/trajectory/:id/frame/offset/:start/:end`, (req, res) => {
  sendTrajectoryFrame(
    req.params.id || "",
    req.params.start || "-1",
    req.params.end || "-1",
    res,
  );
});

app.get(mapPath(`/get/trajectory/:id/starts`), (req, res) => {
  const id: string = req.params.id || "";
  sendTrajectoryStarts(id, res);
});

app.get(mapPath(`/get/trajectory/:id/frame/offset/:start/:end`), (req, res) => {
  const id: string = req.params.id || "";
  sendTrajectoryFrame(
    id,
    req.params.start || "-1",
    req.params.end || "-1",
    res,
  );
});

const schema = getSchema(Config);
app.get(mapPath("/openapi.json"), (req, res) => {
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "X-Requested-With",
  });
  res.end(JSON.stringify(schema));
});

app.use(mapPath("/"), swaggerUiAssetsHandler());
app.get(
  mapPath("/"),
  swaggerUiIndexHandler({
    openapiJsonUrl: mapPath("/openapi.json"),
    apiPrefix: Config.api_prefix,
    title: "PluginSession Server API",
    shortcutIconLink,
  }),
);

createIndex("session");
createIndex("trajectory");
app.listen(Config.port);

console.log(`Mol* Plugin Session - Trajectory Streaming Server`);
console.log("");
console.log(JSON.stringify(Config, null, 2));

// node lib/commonjs/extensions/remote-session/server/index.js --working-folder ../server/session --port 1337
