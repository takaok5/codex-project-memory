import { renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { PmemError } from "./errors.js";

export type JsonParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function safeJsonParse<T>(text: string): JsonParseResult<T> {
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid JSON." };
  }
}

export function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(canonicalize(value));
  } catch (error) {
    throw new PmemError("INTERNAL_ERROR", "Value cannot be serialized as JSON.", {
      details: { cause: error instanceof Error ? error.message : "unknown" }
    });
  }
}

export function writeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    throw new PmemError("INTERNAL_ERROR", "Value cannot be serialized as JSON.", {
      details: { cause: error instanceof Error ? error.message : "unknown" }
    });
  }
}

export function writeJsonFileAtomic(path: string, value: unknown): void {
  const content = writeJson(value);
  const tempPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(tempPath, content);
    renameSync(tempPath, path);
  } catch (error) {
    throw new PmemError("FS_ERROR", "Failed to write JSON file.", {
      details: { cause: error instanceof Error ? error.message : "unknown" }
    });
  }
}

function canonicalize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    throw new TypeError("Circular reference in JSON value.");
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value.map((item) => canonicalize(item, seen));
    seen.delete(value);
    return result;
  }

  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    result[key] = canonicalize(record[key], seen);
  }
  seen.delete(value);
  return result;
}
