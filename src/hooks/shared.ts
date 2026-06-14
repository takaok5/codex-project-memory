import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { safeJsonParse, writeJson, writeJsonFileAtomic } from "../shared/json.js";
import { normalizePathSeparators } from "../shared/path.js";
import { nowIso } from "../shared/time.js";
import { findProjectRoot } from "../runtime/project-locator.js";
import { getMemoryPaths } from "../runtime/memory-paths.js";
import { loadProjectConfig } from "../runtime/config-loader.js";
import { openMemoryDb } from "../store/sqlite.js";
import type { HookOutput, HookRefreshLock, RuntimeContext } from "../shared/types.js";

const IGNORED_PREFIXES = [".codex/memory/", "node_modules/", "dist/", "build/", "coverage/", ".git/"];
const LOCK_TTL_MS = 5 * 60 * 1000;

export async function readHookInput(stream: NodeJS.ReadStream = process.stdin): Promise<{ event: unknown; warnings: string[] }> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return { event: {}, warnings: [] };
  const parsed = safeJsonParse<unknown>(text);
  return parsed.ok ? { event: parsed.value, warnings: [] } : { event: {}, warnings: ["hook_input_invalid"] };
}

export function writeHookJson(output: HookOutput): void {
  process.stdout.write(writeJson(output));
}

export function resolveHookRuntimeContext(cwd = process.cwd()): RuntimeContext | null {
  try {
    const root = findProjectRoot(cwd).root;
    const memoryPaths = getMemoryPaths(root);
    if (!existsSync(memoryPaths.configAbs) || !existsSync(memoryPaths.dbAbs)) return null;
    const config = loadProjectConfig(memoryPaths);
    return { projectRoot: root, memoryPaths, config, db: openMemoryDb(memoryPaths) };
  } catch {
    return null;
  }
}

export function extractChangedFilesFromHookEvent(event: unknown): { files: string[]; warnings: string[] } {
  const record = isRecord(event) ? event : {};
  const files =
    readStringArray(record, ["tool", "output", "filesWritten"]) ??
    readStringArray(record, ["output", "file_paths"]) ??
    readStringArray(record, ["changedFiles"]) ??
    (typeof record.filePath === "string" ? [record.filePath] : null);
  if (!files) return { files: [], warnings: ["hook_event_unrecognized"] };
  return { files: [...new Set(files.map(normalizeCandidate).filter(isAcceptedPath))].sort(), warnings: [] };
}

export function isHookLoopGuardActive(ctx: RuntimeContext): { active: boolean; warning?: string } {
  if (process.env.PMEM_HOOK_RUNNING === "1") return { active: true, warning: "hook_loop_guard_env" };
  const lockPath = hookLockPath(ctx);
  if (!existsSync(lockPath)) return { active: false };
  const parsed = safeJsonParse<HookRefreshLock>(readFileSync(lockPath, "utf8"));
  if (!parsed.ok) return { active: true, warning: "hook_loop_guard_lock" };
  const created = Date.parse(parsed.value.createdAt);
  const age = Date.now() - created;
  if (!Number.isFinite(created) || age < 0 || age <= LOCK_TTL_MS) return { active: true, warning: "hook_loop_guard_lock" };
  return { active: false };
}

export async function withHookLoopGuard<T>(ctx: RuntimeContext, fn: () => Promise<T>): Promise<T> {
  const lockPath = hookLockPath(ctx);
  writeJsonFileAtomic(lockPath, { createdAt: nowIso(), pid: process.pid, reason: "stop-refresh" } satisfies HookRefreshLock);
  const old = process.env.PMEM_HOOK_RUNNING;
  process.env.PMEM_HOOK_RUNNING = "1";
  try {
    return await fn();
  } finally {
    if (old === undefined) delete process.env.PMEM_HOOK_RUNNING;
    else process.env.PMEM_HOOK_RUNNING = old;
    try {
      rmSync(lockPath, { force: true });
    } catch {
      // best effort cleanup
    }
  }
}

export function hookLockPath(ctx: RuntimeContext): string {
  return join(ctx.memoryPaths.cacheDirAbs, "hook-refresh.lock");
}

function readStringArray(record: Record<string, unknown>, path: string[]): string[] | null {
  let current: unknown = record;
  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return Array.isArray(current) ? current.filter((item): item is string => typeof item === "string") : null;
}

function normalizeCandidate(value: string): string {
  return normalizePathSeparators(value.trim()).replace(/^\.\/+/, "");
}

function isAcceptedPath(value: string): boolean {
  if (!value || value.startsWith("/") || value.includes(":") || value.split("/").includes("..")) return false;
  return !IGNORED_PREFIXES.some((prefix) => value === prefix.slice(0, -1) || value.startsWith(prefix));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
