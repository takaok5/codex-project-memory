import { pathToFileURL } from "node:url";
import { getProjectState } from "../store/project-state-repository.js";
import { readHookInput, resolveHookRuntimeContext, writeHookJson } from "./shared.js";
import type { HookOutput } from "../shared/types.js";
import type { MemoryDb } from "../store/sqlite.js";

export async function runUserPromptSubmitHook(cwd = process.cwd()): Promise<HookOutput> {
  const ctx = resolveHookRuntimeContext(cwd);
  if (!ctx) return { ok: true, action: "additional_context", additionalContext: "Project memory is not initialized. Run pmem init --json.", warnings: [] };
  try {
    const state = getProjectState(ctx.db as MemoryDb);
    if (state.status === "dirty" || state.status === "stale") {
      return { ok: true, action: "additional_context", additionalContext: `Project memory is ${state.status}. Run memory.refresh when current context matters.`, warnings: [] };
    }
    return { ok: true, action: "noop", warnings: [] };
  } finally {
    (ctx.db as MemoryDb).close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  readHookInput().then(({ warnings }) => runUserPromptSubmitHook().then((output) => writeHookJson({ ...output, warnings: [...warnings, ...output.warnings] })));
}
