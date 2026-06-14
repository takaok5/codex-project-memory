import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const requiredPackages = [
  "commander",
  "better-sqlite3",
  "ts-morph",
  "zod",
  "@modelcontextprotocol/sdk"
];

try {
  ensureDependencies();
  if (process.env.PMEM_BOOTSTRAP_ONLY === "1") {
    process.exit(0);
  }
  const serverModule = await import(pathToFileURL(path.join(pluginRoot, "dist", "mcp", "server.js")).href);
  await serverModule.runMcpServer();
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`[codex-project-memory] MCP bootstrap failed:\n${message}\n`);
  process.exitCode = 1;
}

function ensureDependencies() {
  const missing = requiredPackages.filter((packageName) => !existsSync(path.join(pluginRoot, "node_modules", packageName, "package.json")));
  if (missing.length === 0) {
    return;
  }

  process.stderr.write(`[codex-project-memory] Installing runtime dependencies on first start: ${missing.join(", ")}\n`);
  const result = spawnSync(npmCommand, ["ci", "--omit=dev", "--no-audit", "--no-fund"], {
    cwd: pluginRoot,
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  if (result.stdout) {
    process.stderr.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`npm ci --omit=dev failed with exit code ${result.status ?? "unknown"}`);
  }
}
