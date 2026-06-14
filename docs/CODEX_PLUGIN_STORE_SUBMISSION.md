# Codex Plugin Store Submission Packet

Date: 2026-06-15

## Current Public Store Status

The current public Codex documentation describes:

- Local and repo marketplace distribution.
- Workspace sharing from the Codex app.
- A curated public plugin directory.

It does not document a self-service command, API, or public web form for
third-party submission to the public Codex Plugin Directory.

Therefore, the correct external next step is to request review through an
official OpenAI channel available to the maintainer, such as OpenAI support,
account/team contact, product feedback, or any private Codex plugin partner
program channel the maintainer has access to.

## Plugin

- Name: `codex-project-memory`
- Version: `0.2.0`
- Display name: Codex Project Memory
- Category: Productivity
- Runtime: Node.js 20+ ESM
- Core storage: project-local SQLite under `.codex/memory/`
- Codex integration: plugin skill plus MCP stdio server
- MCP server name: `project-memory`

## Store Pitch

Codex Project Memory gives Codex a deterministic, project-local memory layer for
software repositories. It indexes TypeScript/JavaScript structure into local
SQLite, renders stable SVG/map frames, and exposes compact MCP tools for project
head state, retrieval, duplicate checks, refresh, frame lookup, diffs, and a
rule-based project memory agent.

Unlike generic RAG or SQL memory plugins, it is repository-aware, schema-bound,
offline-first, and specifically designed to prevent broad source dumps and
global cross-project memory leakage.

## User Value

- Reduces repeated project re-discovery across Codex threads.
- Helps Codex retrieve relevant modules, symbols, routes, tests, and visual
  frames before editing.
- Guards against creating duplicate services, controllers, DTOs, routes,
  modules, repositories, adapters, jobs, or utilities.
- Provides deterministic visual maps that can be compared and diffed.
- Keeps memory scoped to the current project rather than a global user memory.

## Included Public Interfaces

CLI:

```text
pmem init
pmem doctor
pmem scan
pmem index
pmem render
pmem head
pmem query
pmem duplicates
pmem refresh
pmem frame
pmem diff
pmem agent run
pmem agents install
pmem agents list
```

MCP tools:

```text
memory.head
memory.query
memory.duplicates
memory.frame
memory.refresh
memory.diff
memory.agent
```

## Privacy And Data Handling

- No cloud backend.
- No embeddings or vector database.
- No required LLM call in the core runtime.
- Stores project memory locally under `.codex/memory/`.
- Public outputs are designed and tested to avoid absolute paths, Windows
  backslashes, source dumps, and out-of-schema fields.
- See `PRIVACY.md`.

## Security Posture

- MCP server uses stdio.
- Memory agent is project-local and does not modify source code.
- Generated data remains inside the repository unless the user shares it.
- Hook-like lifecycle behavior is implemented through supported Codex skill and
  MCP usage rather than unsupported plugin-declared hooks.
- See `SECURITY.md`.

## Validation Commands

Run before submission:

```bash
npm ci
npm run build
npm test
node dist/cli/pmem.js --help
node dist/cli/pmem.js --version
npm pack --dry-run
```

Optional local plugin validation:

```bash
python C:/Users/FAT-E/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py C:/Users/FAT-E/progetti/MemoryCodex
```

## Submission Request Template

Subject:

```text
Request for Codex public plugin directory review: Codex Project Memory
```

Body:

```text
Hello OpenAI Codex team,

I would like to submit Codex Project Memory for review for the public Codex
Plugin Directory, if third-party submissions are currently accepted.

Codex Project Memory is a project-local repository memory plugin for Codex. It
indexes TypeScript/JavaScript project structure into local SQLite, exposes
schema-bound MCP tools, renders deterministic SVG/map frames, and includes a
rule-based memory agent. It is offline-first, does not require a cloud backend,
does not use embeddings or a vector database, and keeps memory scoped to the
current repository under .codex/memory/.

Version: 0.2.0
Runtime: Node.js 20+ ESM
Interfaces: Codex skill, MCP stdio server, pmem CLI
MCP tools: memory.head, memory.query, memory.duplicates, memory.frame,
memory.refresh, memory.diff, memory.agent

Validation completed:
- npm run build
- npm test
- node dist/cli/pmem.js --help
- node dist/cli/pmem.js --version
- npm pack --dry-run

Privacy and security notes:
- No cloud backend
- No required LLM call
- No embeddings/vector DB
- Project-local storage only
- Public outputs are tested to avoid absolute paths and source dumps

Please let me know the current submission/review process for public Codex
Plugin Directory inclusion and any additional requirements.
```

## Known Open Question For OpenAI

The public docs mention curated public plugins but do not document whether
third-party public store submissions are open, invite-only, or handled through a
specific partner/review process.
