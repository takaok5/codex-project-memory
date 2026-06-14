import { existsSync } from "node:fs";
import { join } from "node:path";
import { writeFileAtomic } from "../shared/fs.js";
export const AGENT_TEMPLATES = [
    {
        file: "pmem-retriever.toml",
        name: "pmem_retriever",
        content: `name = "pmem_retriever"
description = "Read-only project memory retrieval agent. Use it to locate exact modules, files and symbols before implementation."
model_reasoning_effort = "low"
sandbox_mode = "read-only"
developer_instructions = """
Use the project-memory MCP server first.
Call memory.head, then memory.query with the requested intent.
Return strict JSON-compatible findings: modules, files, symbols, constraints, warnings.
Do not edit files.
Do not dump broad repository context.
Do not read memory.db directly.
"""
`
    },
    {
        file: "pmem-duplicate-checker.toml",
        name: "pmem_duplicate_checker",
        content: `name = "pmem_duplicate_checker"
description = "Read-only duplicate guard agent. Use before creating services, controllers, DTOs, routes, tables, modules or utilities."
model_reasoning_effort = "low"
sandbox_mode = "read-only"
developer_instructions = """
Use memory.duplicates with the requested artifact kind and intent.
Return risk, verdict, matches and recommendation.
Do not edit files.
Do not approve creation when high-risk matches exist.
Do not read memory.db directly.
"""
`
    },
    {
        file: "pmem-architecture-reviewer.toml",
        name: "pmem_architecture_reviewer",
        content: `name = "pmem_architecture_reviewer"
description = "Read-only architecture review agent for checking constraints and memory drift."
model_reasoning_effort = "medium"
sandbox_mode = "read-only"
developer_instructions = """
Use memory.head and memory.query.
Check whether proposed changes respect module ownership, critical rules and duplicate guard findings.
Return concise JSON-compatible warnings and recommendations.
Do not edit files.
Do not read memory.db directly.
"""
`
    }
];
export function renderAgentTemplate(name) {
    const template = AGENT_TEMPLATES.find((item) => item.name === name || item.file === name);
    if (!template)
        throw new Error("Unknown agent template.");
    return template.content;
}
export function listAgentTemplates(projectRoot) {
    const dir = join(projectRoot, ".codex", "agents");
    return {
        available: AGENT_TEMPLATES.map((item) => ({ name: item.name, template: item.file })),
        installed: AGENT_TEMPLATES.filter((item) => existsSync(join(dir, item.file))).map((item) => ({ name: item.name, path: `.codex/agents/${item.file}` }))
    };
}
export function installAgentTemplates(projectRoot, options = {}) {
    const dir = join(projectRoot, ".codex", "agents");
    const output = { scope: "project", installed: [], skipped: [], overwritten: [] };
    for (const template of AGENT_TEMPLATES) {
        const rel = `.codex/agents/${template.file}`;
        const abs = join(dir, template.file);
        const existed = existsSync(abs);
        if (existed && !options.force) {
            output.skipped.push(rel);
            continue;
        }
        writeFileAtomic(abs, template.content);
        if (existed)
            output.overwritten.push(rel);
        else
            output.installed.push(rel);
    }
    return output;
}
//# sourceMappingURL=templates.js.map