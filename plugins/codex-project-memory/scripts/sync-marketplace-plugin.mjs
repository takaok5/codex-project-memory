import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const target = path.join(root, "plugins", "codex-project-memory");
const pluginsRoot = path.join(root, "plugins");

if (!target.startsWith(pluginsRoot + path.sep)) {
  throw new Error(`Refusing to sync outside plugins root: ${target}`);
}

const entries = [
  ".codex-plugin",
  "assets",
  "bin",
  "dist",
  "scripts",
  "skills",
  "templates",
  ".mcp.json",
  "CHANGELOG.md",
  "LICENSE",
  "PRIVACY.md",
  "README.md",
  "SECURITY.md",
  "package.json",
  "package-lock.json"
];

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

for (const entry of entries) {
  const source = path.join(root, entry);
  if (!existsSync(source)) {
    throw new Error(`Missing required marketplace sync entry: ${entry}`);
  }

  cpSync(source, path.join(target, entry), { recursive: true });
}

cpSync(path.join(root, "src", "store", "schema.sql"), path.join(target, "dist", "store", "schema.sql"));

console.log(`Synced marketplace plugin to ${path.relative(root, target).replaceAll(path.sep, "/")}`);
