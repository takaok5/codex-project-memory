import { pathToFileURL } from "node:url";
import { cmdRefresh } from "../cli/commands/refresh.js";
import { getProjectState } from "../store/project-state-repository.js";
import { extractChangedFilesFromHookEvent, isHookLoopGuardActive, readHookInput, resolveHookRuntimeContext, withHookLoopGuard, writeHookJson } from "./shared.js";
import type { HookOutput } from "../shared/types.js";
import type { MemoryDb } from "../store/sqlite.js";

export async function runStopHook(event: unknown, cwd = process.cwd()): Promise<HookOutput> {
  const ctx = resolveHookRuntimeContext(cwd);
  const changed = extractChangedFilesFromHookEvent(event);
  if (!ctx) return { ok: true, action: "noop", warnings: changed.warnings };
  try {
    const guard = isHookLoopGuardActive(ctx);
    if (guard.active) return { ok: true, action: "noop", warnings: [guard.warning ?? "hook_loop_guard_lock"] };
    const state = getProjectState(ctx.db as MemoryDb);
    if (state.status !== "dirty" || !ctx.config.hooks.enabled || !ctx.config.hooks.autoRefreshOnStop) return { ok: true, action: "noop", warnings: changed.warnings };
    if (changed.files.length > ctx.config.hooks.maxChangedFilesForStopRefresh) return { ok: true, action: "noop", warnings: ["hook_changed_files_limit"] };
  } finally {
    (ctx.db as MemoryDb).close();
  }
  const refresh = await withHookLoopGuard(ctx, () => cmdRefresh({ cwd, reason: "stop-refresh" }));
  return { ok: true, action: refresh.ok ? "refreshed" : "noop", warnings: refresh.warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  readHookInput().then(({ event, warnings }) => runStopHook(event).then((output) => writeHookJson({ ...output, warnings: [...warnings, ...output.warnings] })));
}
