# Security Policy

## Supported Versions

The current supported line is:

| Version | Supported |
| --- | --- |
| 0.2.x | Yes |
| 0.1.x | No |

## Security Model

Codex Project Memory is local-first:

- It stores memory under `.codex/memory/` inside the current project.
- It exposes a local MCP stdio server and a local CLI.
- It does not require a remote backend, embeddings, vector DB, or LLM call.
- It is designed not to modify source files through the memory agent.
- It validates public outputs for relative POSIX paths and compact schemas.

The plugin can read repository source files to build structural memory. Treat a
repository with untrusted code as sensitive input and use Codex approval and
sandbox settings appropriate for that project.

## Reporting A Vulnerability

Until the project has a public security advisory channel attached to a hosted
repository, report vulnerabilities privately through the maintainer or workspace
that shared the plugin. Do not publish exploit details publicly before a fix or
mitigation is available.

Useful report details:

- Plugin version.
- Operating system and Node.js version.
- Minimal reproduction repository or fixture.
- Whether the issue affects CLI, MCP, generated artifacts, packaging, or Codex
  plugin installation.
- Whether source contents, absolute paths, secrets, or unexpected writes are
  exposed.
