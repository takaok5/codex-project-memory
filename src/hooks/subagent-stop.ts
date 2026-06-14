import { pathToFileURL } from "node:url";
import { readHookInput, writeHookJson } from "./shared.js";
import type { HookOutput } from "../shared/types.js";

export async function runSubagentStopHook(_event: unknown): Promise<HookOutput> {
  return { ok: true, action: "logged", warnings: [] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  readHookInput().then(({ event, warnings }) => runSubagentStopHook(event).then((output) => writeHookJson({ ...output, warnings: [...warnings, ...output.warnings] })));
}
