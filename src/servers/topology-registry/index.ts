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
  createTopologyEntry,
  ensureTopologyDataDirectory,
  getTopologyEntry,
  listTopologyEntries,
  normalizePdbFileName,
  normalizeTopologyId,
  readTopologyFile,
  removeTopologyEntry,
} from "./topology";
import { getSchema, shortcutIconLink } from "./api-schema";

const Config = getConfig();
const ApiRoot = "/api/v1/topology";

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
  bodyParser.text({
    type: ["chemical/x-pdb", "text/plain"],
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
  res.status(status);
  res.json({ errors: [{ code: code || "request", message }] });
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
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(listTopologyEntries(Config)));
});

app.get(mapPath(`${ApiRoot}/:id`), (req, res) => {
  let id: string;
  try {
    id = normalizeTopologyId(req.params.id || "");
  } catch (e) {
    return writeError(
      res,
      400,
      e instanceof Error ? e.message : "Invalid topology id.",
      "valid-id",
    );
  }
  const entry = getTopologyEntry(Config, id);
  if (!entry)
    return writeError(
      res,
      404,
      `Topology '${id}' does not exist.`,
      "missing-topology",
    );
  const content = readTopologyFile(Config, id);
  if (content === void 0)
    return writeError(
      res,
      404,
      `Topology '${id}' does not exist.`,
      "missing-topology",
    );
  res.writeHead(200, { "Content-Type": "chemical/x-pdb; charset=utf-8" });
  res.end(content);
});

app.post(mapPath(ApiRoot), async (req, res) => {
  const url = req.body?.url as string | undefined;
  const rawId = req.body?.id as string | undefined;
  const rawFileName = req.body?.fileName as string | undefined;
  const name = (req.body?.name as string | undefined) || rawId || "";
  const description = (req.body?.description as string | undefined) || "";
  const source = (req.body?.source as string | undefined) || "";

  if (!url)
    return writeError(
      res,
      400,
      "Topology registration requires a source URL.",
      "missing-url",
    );

  let id: string;
  let fileName: string;
  try {
    id = normalizeTopologyId(rawId || "");
    fileName = normalizePdbFileName(rawFileName || `${id}.pdb`);
  } catch (e) {
    return writeError(
      res,
      400,
      e instanceof Error ? e.message : "Invalid topology payload.",
      "valid-topology",
    );
  }

  try {
    const response = await fetch(url);
    if (!response.ok)
      return writeError(
        res,
        400,
        `Failed to fetch topology from '${url}'.`,
        "fetch-topology",
      );
    const content = await response.text();
    const entry = createTopologyEntry(
      Config,
      { id, fileName, name, description, source, format: "pdb" },
      content,
    );
    res.status(201);
    res.json(entry);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to create topology entry.";
    const status = /already exists/i.test(message) ? 409 : 500;
    writeError(
      res,
      status,
      message,
      status === 409 ? "unique-topology" : "create-topology",
    );
  }
});

app.put(mapPath(`${ApiRoot}/:id`), (req, res) => {
  let id: string;
  let fileName: string;
  try {
    id = normalizeTopologyId(req.params.id || "");
    fileName = normalizePdbFileName(
      (req.query.fileName as string | undefined) || `${id}.pdb`,
    );
  } catch (e) {
    return writeError(
      res,
      400,
      e instanceof Error ? e.message : "Invalid topology upload.",
      "valid-topology",
    );
  }

  if (typeof req.body !== "string" || !req.body.trim())
    return writeError(
      res,
      400,
      "Request body must contain PDB text.",
      "request-body",
    );

  try {
    const entry = createTopologyEntry(
      Config,
      {
        id,
        fileName,
        name: (req.query.name as string | undefined) || id,
        description: (req.query.description as string | undefined) || "",
        source: (req.query.source as string | undefined) || "direct-upload",
        format: "pdb",
      },
      req.body,
    );
    res.status(201);
    res.json(entry);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to store topology upload.";
    const status = /already exists/i.test(message) ? 409 : 500;
    writeError(
      res,
      status,
      message,
      status === 409 ? "unique-topology" : "create-topology",
    );
  }
});

app.delete(mapPath(`${ApiRoot}/:id`), (req, res) => {
  let id: string;
  try {
    id = normalizeTopologyId(req.params.id || "");
  } catch (e) {
    return writeError(
      res,
      400,
      e instanceof Error ? e.message : "Invalid topology id.",
      "valid-id",
    );
  }
  if (!removeTopologyEntry(Config, id))
    return writeError(
      res,
      404,
      `Topology '${id}' does not exist.`,
      "missing-topology",
    );
  res.status(200);
  res.end();
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
    title: "Topology Registry API",
    shortcutIconLink,
  }),
);

ensureTopologyDataDirectory(Config);
app.listen(Config.port);

console.log("Mol* Topology Registry");
console.log("");
console.log(JSON.stringify(Config, null, 2));
