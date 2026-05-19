import * as fs from "fs";
import * as path from "path";
import { makeDir } from "../../mol-util/make-dir";
import { Config } from "./config";

export type TopologyEntry = {
  timestamp: number;
  id: string;
  name: string;
  description: string;
  source: string;
  format: "pdb";
  fileName: string;
};

export type TopologyIndex = TopologyEntry[];

const AllowedId = /^[A-Za-z0-9._-]+$/;

export function getTopologyDataDirectory(config: Config) {
  return path.join(config.working_folder, "files");
}

export function getTopologyIndexPath(config: Config) {
  return path.join(config.working_folder, "index.json");
}

export function ensureTopologyDataDirectory(config: Config) {
  if (!fs.existsSync(config.working_folder)) makeDir(config.working_folder);
  const dir = getTopologyDataDirectory(config);
  if (!fs.existsSync(dir)) makeDir(dir);
  const indexPath = getTopologyIndexPath(config);
  if (!fs.existsSync(indexPath)) fs.writeFileSync(indexPath, "[]", "utf-8");
}

export function normalizeTopologyId(id: string) {
  const normalized = (id || "").trim();
  if (!normalized) throw new Error("Topology id must not be empty.");
  if (
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes("..")
  )
    throw new Error(
      "Topology id must not contain path separators or parent directory segments.",
    );
  if (!AllowedId.test(normalized))
    throw new Error(
      "Topology id may only contain letters, numbers, dot, underscore, and hyphen.",
    );
  return normalized;
}

export function normalizePdbFileName(name: string) {
  const normalized = normalizeTopologyId(name);
  if (!normalized.endsWith(".pdb"))
    throw new Error("Topology file name must end with .pdb.");
  return normalized;
}

export function getTopologyFilePath(config: Config, fileName: string) {
  return path.join(
    getTopologyDataDirectory(config),
    normalizePdbFileName(fileName),
  );
}

export function readTopologyIndex(config: Config): TopologyIndex {
  const indexPath = getTopologyIndexPath(config);
  if (!fs.existsSync(indexPath)) return [];
  return JSON.parse(fs.readFileSync(indexPath, "utf-8")) as TopologyIndex;
}

export function writeTopologyIndex(config: Config, index: TopologyIndex) {
  fs.writeFileSync(
    getTopologyIndexPath(config),
    JSON.stringify(index, null, 2),
    "utf-8",
  );
}

export function getTopologyEntry(config: Config, id: string) {
  const normalized = normalizeTopologyId(id);
  return readTopologyIndex(config).find((entry) => entry.id === normalized);
}

export function listTopologyEntries(config: Config) {
  return readTopologyIndex(config)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name) || a.timestamp - b.timestamp);
}

export function createTopologyEntry(
  config: Config,
  entry: Omit<TopologyEntry, "timestamp">,
  content: string,
) {
  const index = readTopologyIndex(config);
  if (index.some((existing) => existing.id === entry.id))
    throw new Error(`Topology '${entry.id}' already exists.`);
  if (index.some((existing) => existing.fileName === entry.fileName))
    throw new Error(`Topology file '${entry.fileName}' already exists.`);
  fs.writeFileSync(getTopologyFilePath(config, entry.fileName), content, {
    encoding: "utf8",
  });
  const createdEntry: TopologyEntry = { ...entry, timestamp: +new Date() };
  index.push(createdEntry);
  writeTopologyIndex(config, index);
  return createdEntry;
}

export type UpdateTopologyEntryParams = {
  id?: string;
  name?: string;
  description?: string;
  source?: string;
};

export function updateTopologyEntry(
  config: Config,
  id: string,
  updates: UpdateTopologyEntryParams,
) {
  const normalized = normalizeTopologyId(id);
  const index = readTopologyIndex(config);
  const entryIndex = index.findIndex((existing) => existing.id === normalized);
  if (entryIndex < 0) return void 0;

  const entry = index[entryIndex];
  const nextId =
    updates.id === void 0 ? entry.id : normalizeTopologyId(updates.id);
  const nextFileName =
    nextId === entry.id
      ? entry.fileName
      : normalizePdbFileName(`${nextId}.pdb`);

  if (nextId !== entry.id && index.some((existing) => existing.id === nextId))
    throw new Error(`Topology '${nextId}' already exists.`);
  if (
    nextFileName !== entry.fileName &&
    index.some((existing) => existing.fileName === nextFileName)
  )
    throw new Error(`Topology file '${nextFileName}' already exists.`);

  if (nextFileName !== entry.fileName) {
    fs.renameSync(
      getTopologyFilePath(config, entry.fileName),
      getTopologyFilePath(config, nextFileName),
    );
  }

  const updatedEntry: TopologyEntry = {
    ...entry,
    id: nextId,
    fileName: nextFileName,
    name: updates.name === void 0 ? entry.name : updates.name,
    description:
      updates.description === void 0 ? entry.description : updates.description,
    source: updates.source === void 0 ? entry.source : updates.source,
  };

  index[entryIndex] = updatedEntry;
  writeTopologyIndex(config, index);
  return updatedEntry;
}

export function removeTopologyEntry(config: Config, id: string) {
  const normalized = normalizeTopologyId(id);
  const index = readTopologyIndex(config);
  const entry = index.find((existing) => existing.id === normalized);
  if (!entry) return false;
  const nextIndex = index.filter((existing) => existing.id !== normalized);
  writeTopologyIndex(config, nextIndex);
  try {
    fs.unlinkSync(getTopologyFilePath(config, entry.fileName));
  } catch {}
  return true;
}

export function readTopologyFile(config: Config, id: string) {
  const entry = getTopologyEntry(config, id);
  if (!entry) return void 0;
  return fs.readFileSync(getTopologyFilePath(config, entry.fileName), "utf-8");
}
