import { pathToFileURL } from "node:url";
import { markMemoryDirty } from "../store/project-state-repository.js";
import { extractChangedFilesFromHookEvent, readHookInput, resolveHookRuntimeContext, writeHookJson } from "./shared.js";
import type { HookOutput } from "../shared/types.js";
import type { MemoryDb } from "../store/sqlite.js";

export async function runPostToolUseHook(event: unknown, cwd = process.cwd()): Promise<HookOutput> {
  const changed = extractChangedFilesFromHookEvent(event);
  const ctx = resolveHookRuntimeContext(cwd);
  if (!ctx) return { ok: true, action: "noop", warnings: changed.warnings };
  try {
    if (changed.files.length === 0) return { ok: true, action: "noop", warnings: changed.warnings };
    markMemoryDirty(ctx.db as MemoryDb, `hook changed files: ${changed.files.slice(0, 5).join(", ")}`);
    return { ok: true, action: "marked_dirty", warnings: changed.warnings };
  } finally {
    (ctx.db as MemoryDb).close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  readHookInput().then(({ event, warnings }) => runPostToolUseHook(event).then((output) => writeHookJson({ ...output, warnings: [...warnings, ...output.warnings] })));
}
