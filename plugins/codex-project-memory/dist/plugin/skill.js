import { PmemError } from "../shared/errors.js";
export function buildRepoMemorySkillDoc(options) {
    if (options.pluginName !== "codex-project-memory" || options.cliCommand !== "pmem" || options.mcpServerName !== "project-memory") {
        throw new PmemError("TEMPLATE_ERROR", "Unsupported repo memory skill options.");
    }
    return `---
name: repo-memory
description: Use Codex Project Memory in repositories with the project-memory MCP server installed.
---

# Repo Memory

Use this skill when working in a repository that has Codex Project Memory installed.

## Core workflow

1. Prefer \`memory.agent\` for project-memory lifecycle orchestration.
2. Use granular tools only when debugging or when a narrower read is enough.
3. Before creating a service, controller, DTO, route, table, module, repository, adapter, job or utility, pass an \`artifact\` to \`memory.agent\`.
4. Prefer the files, symbols, constraints and warnings returned by project-memory over broad repository search.
5. After changes, use \`memory.agent\` with \`phase: "post_change"\` or \`pmem agent run --phase post_change --json\`.

## Supported lifecycle

Codex app plugin validation does not currently accept plugin-declared hooks. Use this implicit skill plus MCP tools as the supported project lifecycle:

- Prompt start: call \`memory.agent\` with \`phase: "pre_task"\`.
- Implementation intent: call \`memory.agent\` with the user request before editing.
- New artifact intent: call \`memory.agent\` with \`phase: "pre_create"\` and \`artifact\`.
- After source changes: call \`memory.agent\` with \`phase: "post_change"\`.
- Visual orientation: call \`memory.agent\` with \`phase: "orient"\`.
- Review/closeout: call \`memory.agent\` with \`phase: "review"\`.

Granular fallback tools: \`memory.head\`, \`memory.query\`, \`memory.duplicates\`, \`memory.frame\`, \`memory.refresh\`, \`memory.diff\`.

## Hard rules

- Do not read \`.codex/memory/memory.db\` directly.
- Do not dump broad source files into the answer.
- Do not create duplicate artifacts when \`memory.duplicates\` returns high risk.
- Do not rely on PNG existing; SVG and map JSON are the primary frame artifacts.
- Do not treat optional subagents as required runtime.
- Do not modify source code from memory tools.

## Useful commands

\`\`\`bash
pmem agent run "<intent>" --json
pmem agent run "<intent>" --phase pre_create --kind service --module <moduleId> --name <ProposedName> --json
pmem head --json
pmem query "<intent>" --json
pmem duplicates --kind service --module <moduleId> --name <ProposedName> "<intent>" --json
pmem frame current --json
pmem refresh --changed-only --json
pmem diff --json
\`\`\`

## Trust note

This plugin does not install lifecycle hooks through \`.codex-plugin/plugin.json\`. The supported lifecycle is the implicit skill policy above plus \`memory.agent\` and the granular MCP tools exposed by \`project-memory\`.
`;
}
//# sourceMappingURL=skill.js.map