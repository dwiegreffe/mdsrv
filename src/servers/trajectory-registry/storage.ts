import * as fs from "fs";
import * as path from "path";
import { makeDir } from "../../mol-util/make-dir";
import { Config } from "./config";
import { getFrameStartsIndexPath } from "./xtc";

export type TrajectoryEntry = {
  timestamp: number;
  id: string;
  name: string;
  description: string;
  source: string;
  format: "xtc";
  fileName: string;
};

export type TrajectoryIndex = TrajectoryEntry[];

const AllowedId = /^[A-Za-z0-9._-]+$/;

export function getTrajectoryDataDirectory(config: Config) {
  return path.join(config.working_folder, "files");
}

export function getTrajectoryIndexPath(config: Config) {
  return path.join(config.working_folder, "index.json");
}

export function ensureTrajectoryDataDirectory(config: Config) {
  if (!fs.existsSync(config.working_folder)) makeDir(config.working_folder);
  const dir = getTrajectoryDataDirectory(config);
  if (!fs.existsSync(dir)) makeDir(dir);
  const indexPath = getTrajectoryIndexPath(config);
  if (!fs.existsSync(indexPath)) fs.writeFileSync(indexPath, "[]", "utf-8");
}

export function normalizeTrajectoryId(id: string) {
  const normalized = (id || "").trim();
  if (!normalized) throw new Error("Trajectory id must not be empty.");
  if (
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes("..")
  )
    throw new Error(
      "Trajectory id must not contain path separators or parent directory segments.",
    );
  if (!AllowedId.test(normalized))
    throw new Error(
      "Trajectory id may only contain letters, numbers, dot, underscore, and hyphen.",
    );
  return normalized;
}

export function normalizeXtcFileName(name: string) {
  const normalized = normalizeTrajectoryId(name);
  if (!normalized.endsWith(".xtc"))
    throw new Error("Trajectory file name must end with .xtc.");
  return normalized;
}

export function getTrajectoryFilePath(config: Config, fileName: string) {
  return path.join(
    getTrajectoryDataDirectory(config),
    normalizeXtcFileName(fileName),
  );
}

export function readTrajectoryIndex(config: Config): TrajectoryIndex {
  const indexPath = getTrajectoryIndexPath(config);
  if (!fs.existsSync(indexPath)) return [];
  return JSON.parse(fs.readFileSync(indexPath, "utf-8")) as TrajectoryIndex;
}

export function writeTrajectoryIndex(config: Config, index: TrajectoryIndex) {
  fs.writeFileSync(
    getTrajectoryIndexPath(config),
    JSON.stringify(index, null, 2),
    "utf-8",
  );
}

export function listTrajectoryEntries(config: Config) {
  return readTrajectoryIndex(config)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name) || a.timestamp - b.timestamp);
}

export function getTrajectoryEntry(config: Config, id: string) {
  const normalized = normalizeTrajectoryId(id);
  return readTrajectoryIndex(config).find((entry) => entry.id === normalized);
}

export function readTrajectoryFile(config: Config, id: string) {
  const entry = getTrajectoryEntry(config, id);
  if (!entry) return void 0;
  return fs.readFileSync(getTrajectoryFilePath(config, entry.fileName));
}

export function createTrajectoryEntry(
  config: Config,
  entry: Omit<TrajectoryEntry, "timestamp">,
  content: Buffer,
) {
  const index = readTrajectoryIndex(config);
  if (index.some((existing) => existing.id === entry.id))
    throw new Error(`Trajectory '${entry.id}' already exists.`);
  if (index.some((existing) => existing.fileName === entry.fileName))
    throw new Error(`Trajectory file '${entry.fileName}' already exists.`);
  fs.writeFileSync(getTrajectoryFilePath(config, entry.fileName), content);
  const createdEntry: TrajectoryEntry = { ...entry, timestamp: +new Date() };
  index.push(createdEntry);
  writeTrajectoryIndex(config, index);
  return createdEntry;
}

export type UpdateTrajectoryEntryParams = {
  id?: string;
  name?: string;
  description?: string;
  source?: string;
};

export function updateTrajectoryEntry(
  config: Config,
  id: string,
  updates: UpdateTrajectoryEntryParams,
) {
  const normalized = normalizeTrajectoryId(id);
  const index = readTrajectoryIndex(config);
  const entryIndex = index.findIndex((existing) => existing.id === normalized);
  if (entryIndex < 0) return void 0;

  const entry = index[entryIndex];
  const nextId =
    updates.id === void 0 ? entry.id : normalizeTrajectoryId(updates.id);
  const nextFileName =
    nextId === entry.id
      ? entry.fileName
      : normalizeXtcFileName(`${nextId}.xtc`);

  if (nextId !== entry.id && index.some((existing) => existing.id === nextId))
    throw new Error(`Trajectory '${nextId}' already exists.`);
  if (
    nextFileName !== entry.fileName &&
    index.some((existing) => existing.fileName === nextFileName)
  )
    throw new Error(`Trajectory file '${nextFileName}' already exists.`);

  if (nextFileName !== entry.fileName) {
    const sourcePath = getTrajectoryFilePath(config, entry.fileName);
    const targetPath = getTrajectoryFilePath(config, nextFileName);
    fs.renameSync(sourcePath, targetPath);

    const sourceStartsPath = getFrameStartsIndexPath(sourcePath);
    if (fs.existsSync(sourceStartsPath)) {
      fs.renameSync(sourceStartsPath, getFrameStartsIndexPath(targetPath));
    }
  }

  const updatedEntry: TrajectoryEntry = {
    ...entry,
    id: nextId,
    fileName: nextFileName,
    name: updates.name === void 0 ? entry.name : updates.name,
    description:
      updates.description === void 0 ? entry.description : updates.description,
    source: updates.source === void 0 ? entry.source : updates.source,
  };

  index[entryIndex] = updatedEntry;
  writeTrajectoryIndex(config, index);
  return updatedEntry;
}

export function removeTrajectoryEntry(config: Config, id: string) {
  const normalized = normalizeTrajectoryId(id);
  const index = readTrajectoryIndex(config);
  const entry = index.find((existing) => existing.id === normalized);
  if (!entry) return false;
  writeTrajectoryIndex(
    config,
    index.filter((existing) => existing.id !== normalized),
  );
  try {
    const filePath = getTrajectoryFilePath(config, entry.fileName);
    fs.unlinkSync(filePath);
    const startsPath = getFrameStartsIndexPath(filePath);
    if (fs.existsSync(startsPath)) fs.unlinkSync(startsPath);
  } catch {}
  return true;
}
