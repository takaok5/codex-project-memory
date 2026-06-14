import type { HooksConfig, HooksConfigOptions, JsonObject } from "../shared/types.js";

const HOOK_NAMES = ["UserPromptSubmit", "PostToolUse", "Stop", "SubagentStop"] as const;
const HOOK_FILES = {
  UserPromptSubmit: "user-prompt-submit.js",
  PostToolUse: "post-tool-use.js",
  Stop: "stop.js",
  SubagentStop: "subagent-stop.js"
} as const;

export function buildHooksConfig(options: HooksConfigOptions = {}): HooksConfig {
  const pluginRoot = options.pluginRootVar ?? "${PLUGIN_ROOT}";
  const hooks: JsonObject = {};

  for (const hookName of HOOK_NAMES) {
    hooks[hookName] = [
      {
        hooks: [
          {
            type: "command",
            command: `node ${pluginRoot}/dist/hooks/${HOOK_FILES[hookName]}`
          }
        ]
      }
    ];
  }

  return { hooks };
}
