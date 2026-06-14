# Marketplace Sharing

This repository is a Codex marketplace root. The marketplace file is:

```text
.agents/plugins/marketplace.json
```

The marketplace entry points to the distributable plugin folder with
`source.path: "./plugins/codex-project-memory"`.

Regenerate that folder before sharing changes:

```bash
npm run build
npm run marketplace:sync
```

The distributable plugin folder contains:

```text
.codex-plugin/plugin.json
.mcp.json
skills/
dist/
package.json
```

## Share From A Git Repository

Publish or share this repository, then ask users to add it as a marketplace:

```bash
codex plugin marketplace add owner/codex-project-memory --ref main
```

For a full Git URL:

```bash
codex plugin marketplace add https://github.com/owner/codex-project-memory.git --ref main
```

Then users should:

```bash
codex plugin marketplace list
```

Open the Codex Plugin Directory, select the **Codex Project Memory**
marketplace, install **Codex Project Memory**, restart Codex if needed, and
start a new thread.

## Share From A Local Folder Or Archive

Send the repository folder or archive. After unpacking it, users can run:

```bash
codex plugin marketplace add /absolute/path/to/codex-project-memory
```

On Windows PowerShell:

```powershell
codex plugin marketplace add C:\path\to\codex-project-memory
```

## Updating

After pulling a new version of the repository:

```bash
codex plugin marketplace upgrade codex-project-memory
```

Then reinstall or refresh the plugin from the Plugin Directory and start a new
thread so Codex loads the updated plugin bundle.

## Maintainer Checklist

Before sharing a version:

```bash
npm ci
npm run build
npm test
node dist/cli/pmem.js --help
node dist/cli/pmem.js --version
npm run marketplace:sync
npm pack --dry-run
python C:/Users/FAT-E/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py C:/Users/FAT-E/progetti/MemoryCodex
python C:/Users/FAT-E/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py C:/Users/FAT-E/progetti/MemoryCodex/plugins/codex-project-memory
```

Do not commit `node_modules/`, `.codex/memory/`, local `.tgz` files, or runtime
memory artifacts.
