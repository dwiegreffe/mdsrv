import express from "express";
import compression from "compression";
import cors from "cors";
import * as bodyParser from "body-parser";
import fetch from "node-fetch";
import {
  swaggerUiAssetsHandler,
  swaggerUiIndexHandler,
} from "../common/swagger-ui";
import { getConfig } from "./config";
import {
  aggregateTrajectoryRequestLogs,
  appendTrajectoryRequestLog,
  defaultMonitorMessage,
  describeTrajectoryRequest,
  ensureTrajectoryMonitorDirectory,
  getRequestClientIp,
  renderTrajectoryMonitorPage,
} from "./monitor";
import {
  createTrajectoryEntry,
  ensureTrajectoryDataDirectory,
  getTrajectoryEntry,
  getTrajectoryFilePath,
  listTrajectoryEntries,
  normalizeTrajectoryId,
  normalizeXtcFileName,
  readTrajectoryFile,
  removeTrajectoryEntry,
} from "./storage";
import {
  getFrameRangeByIndexData,
  getFrameStarts,
  getSingleFrameData,
} from "./xtc";
import { getSchema, shortcutIconLink } from "./api-schema";

const Config = getConfig();
const ApiRoot = "/api/v1/trajectory";

const app = express();
app.use(
  compression(<any>{
    level: 6,
    memLevel: 9,
    chunkSize: 16 * 16384,
    filter: () => true,
  }),
);
app.use(cors({ methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(bodyParser.json({ limit: "1mb" }));
app.use(
  bodyParser.raw({
    type: ["application/octet-stream"],
    limit: Config.upload_limit,
  }),
);

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
  res.locals.monitorMessage = message;
  res.status(status);
  res.json({ errors: [{ code: code || "request", message }] });
}

const MappedApiRoot = mapPath(ApiRoot);

app.use((req, res, next) => {
  const descriptor = describeTrajectoryRequest(
    req.method,
    req.path,
    MappedApiRoot,
  );
  if (!descriptor) return next();

  const started = Date.now();
  res.on("finish", () => {
    appendTrajectoryRequestLog(Config, {
      ts: new Date().toISOString(),
      kind: "trajectory-request",
      method: req.method,
      path: req.originalUrl,
      endpoint: descriptor.endpoint,
      trajectoryId: descriptor.trajectoryId,
      start: descriptor.start,
      end: descriptor.end,
      status: res.statusCode,
      durationMs: Date.now() - started,
      ip: getRequestClientIp(req),
      message:
        res.locals.monitorMessage || defaultMonitorMessage(res.statusCode),
    });
  });

  next();
});

function parseTrajectoryId(rawId: string, res: express.Response) {
  try {
    return normalizeTrajectoryId(rawId || "");
  } catch (e) {
    writeError(
      res,
      400,
      e instanceof Error ? e.message : "Invalid trajectory id.",
      "valid-id",
    );
    return void 0;
  }
}

function parseFramePosition(
  value: string,
  field: "start" | "end",
  res: express.Response,
) {
  if (field === "end" && value === "Infinity") return Infinity;
  const parsed = parseInt(value || "-1", 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    writeError(res, 400, `Invalid frame ${field} offset.`, "valid-frame-range");
    return void 0;
  }
  return parsed;
}

async function resolveTrajectoryFilePath(id: string, res: express.Response) {
  const entry = getTrajectoryEntry(Config, id);
  if (!entry) {
    writeError(
      res,
      404,
      `Trajectory '${id}' does not exist.`,
      "missing-trajectory",
    );
    return void 0;
  }
  return getTrajectoryFilePath(Config, entry.fileName);
}

async function sendSingleFrame(
  filePath: string,
  start: number,
  end: number,
  res: express.Response,
) {
  if (end !== Infinity && end <= start)
    return writeError(
      res,
      400,
      "Frame end offset must be greater than frame start offset.",
      "valid-frame-range",
    );
  try {
    const file = await getSingleFrameData(filePath, start, end);
    res.json(file);
  } catch {
    return writeError(
      res,
      404,
      `Frame '${start}:${end}' could not be read.`,
      "missing-frame",
    );
  }
}

async function sendFrameRangeByIndex(
  filePath: string,
  index: number,
  count: number,
  res: express.Response,
) {
  try {
    const file = await getFrameRangeByIndexData(filePath, index, count);
    res.json(file);
  } catch {
    return writeError(
      res,
      404,
      `Frame range '${index}:${count}' could not be read.`,
      "missing-frame",
    );
  }
}

function parseFrameIndex(value: string, res: express.Response) {
  const parsed = parseInt(value || "-1", 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    writeError(res, 400, "Invalid frame range index.", "valid-frame-range");
    return void 0;
  }
  return parsed;
}

function parseFrameCount(value: string, res: express.Response) {
  const parsed = parseInt(value || "0", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    writeError(res, 400, "Invalid frame range count.", "valid-frame-range");
    return void 0;
  }
  return parsed;
}

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (err?.type === "entity.too.large")
      return writeError(
        res,
        413,
        `Upload exceeds configured limit '${Config.upload_limit}'.`,
        "upload-limit",
      );
    next(err);
  },
);

app.get(mapPath(ApiRoot), (req, res) => {
  res.locals.monitorMessage = "Listed stored trajectories.";
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(listTrajectoryEntries(Config)));
});

app.get(mapPath(`${ApiRoot}/monitor/requests`), (req, res) => {
  try {
    res.locals.monitorMessage = "Read aggregated trajectory request metrics.";
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify(
        aggregateTrajectoryRequestLogs(Config, {
          from: req.query.from as string | undefined,
          to: req.query.to as string | undefined,
          bucket: req.query.bucket as string | undefined,
          trajectoryId: req.query.trajectoryId as string | undefined,
          endpoint: req.query.endpoint as string | undefined,
          status: req.query.status as string | undefined,
        }),
      ),
    );
  } catch (e) {
    return writeError(
      res,
      400,
      e instanceof Error ? e.message : "Invalid request monitor query.",
      "valid-monitor-query",
    );
  }
});

app.get(mapPath(`${ApiRoot}/monitor/plot`), (req, res) => {
  res.locals.monitorMessage = "Opened trajectory request monitor page.";
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(renderTrajectoryMonitorPage(mapPath(`${ApiRoot}/monitor/requests`)));
});

app.post(mapPath(ApiRoot), async (req, res) => {
  const url = req.body?.url as string | undefined;
  const rawId = req.body?.id as string | undefined;
  const name = (req.body?.name as string | undefined) || rawId || "";
  const description = (req.body?.description as string | undefined) || "";
  const source = (req.body?.source as string | undefined) || "";

  if (!url)
    return writeError(
      res,
      400,
      "Trajectory upload requires a source URL.",
      "missing-url",
    );

  let id: string;
  let fileName: string;
  try {
    id = normalizeTrajectoryId(rawId || "");
    fileName = normalizeXtcFileName(`${id}.xtc`);
  } catch (e) {
    return writeError(
      res,
      400,
      e instanceof Error ? e.message : "Invalid trajectory payload.",
      "valid-trajectory",
    );
  }

  try {
    const response = await fetch(url);
    if (!response.ok)
      return writeError(
        res,
        400,
        `Failed to fetch trajectory from '${url}'.`,
        "fetch-trajectory",
      );
    const buffer = await response.buffer();
    const entry = createTrajectoryEntry(
      Config,
      { id, name, description, source, format: "xtc", fileName },
      buffer,
    );
    res.locals.monitorMessage = `Stored trajectory '${id}' from remote URL.`;
    res.status(201);
    res.json(entry);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to create trajectory entry.";
    const status = /already exists/i.test(message) ? 409 : 500;
    writeError(
      res,
      status,
      message,
      status === 409 ? "unique-trajectory" : "create-trajectory",
    );
  }
});

app.get(mapPath(`${ApiRoot}/:id`), (req, res) => {
  let id: string;
  try {
    id = normalizeTrajectoryId(req.params.id || "");
  } catch (e) {
    return writeError(
      res,
      400,
      e instanceof Error ? e.message : "Invalid trajectory id.",
      "valid-id",
    );
  }
  const entry = getTrajectoryEntry(Config, id);
  if (!entry)
    return writeError(
      res,
      404,
      `Trajectory '${id}' does not exist.`,
      "missing-trajectory",
    );
  const content = readTrajectoryFile(Config, id);
  if (content === void 0)
    return writeError(
      res,
      404,
      `Trajectory '${id}' does not exist.`,
      "missing-trajectory",
    );
  res.locals.monitorMessage = `Read stored trajectory '${id}'.`;
  res.writeHead(200, { "Content-Type": "application/octet-stream" });
  res.end(content);
});

app.put(mapPath(`${ApiRoot}/:id`), (req, res) => {
  let id: string;
  let fileName: string;
  try {
    id = normalizeTrajectoryId(req.params.id || "");
    fileName = normalizeXtcFileName(
      (req.query.fileName as string | undefined) || `${id}.xtc`,
    );
  } catch (e) {
    return writeError(
      res,
      400,
      e instanceof Error ? e.message : "Invalid trajectory upload.",
      "valid-trajectory",
    );
  }

  if (!Buffer.isBuffer(req.body) || req.body.length === 0)
    return writeError(
      res,
      400,
      "Request body must contain XTC binary data.",
      "request-body",
    );

  try {
    const entry = createTrajectoryEntry(
      Config,
      {
        id,
        fileName,
        name: (req.query.name as string | undefined) || id,
        description: (req.query.description as string | undefined) || "",
        source: (req.query.source as string | undefined) || "direct-upload",
        format: "xtc",
      },
      req.body,
    );
    res.locals.monitorMessage = `Uploaded trajectory '${id}'.`;
    res.status(201);
    res.json(entry);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to store trajectory upload.";
    const status = /already exists/i.test(message) ? 409 : 500;
    writeError(
      res,
      status,
      message,
      status === 409 ? "unique-trajectory" : "create-trajectory",
    );
  }
});

app.delete(mapPath(`${ApiRoot}/:id`), (req, res) => {
  let id: string;
  try {
    id = normalizeTrajectoryId(req.params.id || "");
  } catch (e) {
    return writeError(
      res,
      400,
      e instanceof Error ? e.message : "Invalid trajectory id.",
      "valid-id",
    );
  }
  if (!removeTrajectoryEntry(Config, id))
    return writeError(
      res,
      404,
      `Trajectory '${id}' does not exist.`,
      "missing-trajectory",
    );
  res.locals.monitorMessage = `Removed trajectory '${id}'.`;
  res.status(200);
  res.end();
});

app.get(mapPath(`${ApiRoot}/:id/starts`), async (req, res) => {
  const id = parseTrajectoryId(req.params.id || "", res);
  if (!id) return;
  const filePath = await resolveTrajectoryFilePath(id, res);
  if (!filePath) return;
  try {
    const starts = await getFrameStarts(filePath);
    res.locals.monitorMessage = `Streamed frame starts for trajectory '${id}'.`;
    res.write(`${starts}`);
    res.end();
  } catch {
    return writeError(
      res,
      404,
      `Trajectory '${id}' could not be streamed.`,
      "stream-trajectory",
    );
  }
});

app.get(
  mapPath(`${ApiRoot}/:id/frame/offset/:start/:end`),
  async (req, res) => {
    const id = parseTrajectoryId(req.params.id || "", res);
    if (!id) return;
    const filePath = await resolveTrajectoryFilePath(id, res);
    if (!filePath) return;
    const start = parseFramePosition(req.params.start || "", "start", res);
    if (start === void 0) return;
    const end = parseFramePosition(req.params.end || "", "end", res);
    if (end === void 0) return;
    res.locals.monitorMessage = `Streamed single frame for trajectory '${id}'.`;
    return sendSingleFrame(filePath, start, end, res);
  },
);

app.get(mapPath(`${ApiRoot}/:id/frame/start/:start`), async (req, res) => {
  const id = parseTrajectoryId(req.params.id || "", res);
  if (!id) return;
  const filePath = await resolveTrajectoryFilePath(id, res);
  if (!filePath) return;
  const start = parseFramePosition(req.params.start || "", "start", res);
  if (start === void 0) return;

  try {
    const starts = await getFrameStarts(filePath);
    const index = starts.indexOf(start);
    if (index < 0)
      return writeError(
        res,
        404,
        `Frame start '${start}' does not exist.`,
        "missing-frame",
      );
    const end = index === starts.length - 1 ? Infinity : starts[index + 1];
    res.locals.monitorMessage = `Streamed single frame by start for trajectory '${id}'.`;
    return sendSingleFrame(filePath, start, end, res);
  } catch {
    return writeError(
      res,
      404,
      `Trajectory '${id}' could not be streamed.`,
      "stream-trajectory",
    );
  }
});

app.get(
  mapPath(`${ApiRoot}/:id/frame-range/index/:index/:count`),
  async (req, res) => {
    const id = parseTrajectoryId(req.params.id || "", res);
    if (!id) return;
    const filePath = await resolveTrajectoryFilePath(id, res);
    if (!filePath) return;
    const index = parseFrameIndex(req.params.index || "", res);
    if (index === void 0) return;
    const count = parseFrameCount(req.params.count || "", res);
    if (count === void 0) return;
    res.locals.monitorMessage = `Streamed frame range by index for trajectory '${id}'.`;
    return sendFrameRangeByIndex(filePath, index, count, res);
  },
);

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
    title: "Trajectory Registry API",
    shortcutIconLink,
  }),
);

ensureTrajectoryDataDirectory(Config);
ensureTrajectoryMonitorDirectory(Config);
app.listen(Config.port);

console.log("Mol* Trajectory Registry");
console.log("");
console.log(JSON.stringify(Config, null, 2));
