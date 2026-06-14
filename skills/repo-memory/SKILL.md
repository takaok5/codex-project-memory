# Repo Memory

Use this skill when working in a repository that has Codex Project Memory installed.

## Core workflow

1. Call `memory.head` before planning implementation.
2. If status is `not_initialized`, ask the user to run or approve `pmem init --json`.
3. For any code-change intent, call `memory.query` with the user intent.
4. Before creating a service, controller, DTO, route, table, module, repository, adapter, job or utility, call `memory.duplicates`.
5. Prefer the files, symbols, constraints and warnings returned by project-memory over broad repository search.
6. Use `memory.frame` when a visual frame helps locate modules or risks.
7. After changes, use `memory.refresh` or `pmem refresh --changed-only --json` when appropriate.

## Hard rules

- Do not read `.codex/memory/memory.db` directly.
- Do not dump broad source files into the answer.
- Do not create duplicate artifacts when `memory.duplicates` returns high risk.
- Do not rely on PNG existing; SVG and map JSON are the primary frame artifacts.
- Do not treat optional subagents as required runtime.
- Do not modify source code from hooks or memory tools.

## Useful commands

```bash
pmem head --json
pmem query "<intent>" --json
pmem duplicates --kind service --module <moduleId> --name <ProposedName> "<intent>" --json
pmem frame current --json
pmem refresh --changed-only --json
pmem diff --json
```

## Trust note

Hook execution must be reviewed and trusted by the user before activation. Hooks are designed to be conservative, no-op safe and non-invasive.
