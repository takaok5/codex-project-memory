import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { addRuntimeEvidenceRun, listRuntimeEvidenceItems, listRuntimeEvidenceRuns } from "../store/evidence-repository.js";
import type { RuntimeContext, RuntimeEvidenceKind, RuntimeEvidenceOutput, RuntimeEvidenceRunInput } from "../shared/types.js";
import type { MemoryDb } from "../store/sqlite.js";

export interface RuntimeEvidenceRunOptions {
  kinds: RuntimeEvidenceKind[];
  timeoutMs?: number;
}

interface RuntimeCommandSpec {
  kind: RuntimeEvidenceKind;
  command: string;
  args: string[];
  label: string;
  timeoutMs: number;
}

export function runRuntimeEvidence(ctx: RuntimeContext, options: RuntimeEvidenceRunOptions): RuntimeEvidenceOutput {
  const db = ctx.db as MemoryDb;
  const specs = discoverRuntimeCommands(ctx.projectRoot, options.kinds, options.timeoutMs ?? 60000);
  for (const spec of specs) {
    addRuntimeEvidenceRun(db, executeRuntimeCommand(ctx.projectRoot, spec));
  }
  return listRuntimeEvidence(ctx);
}

export function listRuntimeEvidence(ctx: RuntimeContext): RuntimeEvidenceOutput {
  const db = ctx.db as MemoryDb;
  const runs = listRuntimeEvidenceRuns(db, 20);
  const items = listRuntimeEvidenceItems(db, { limit: 100 });
  return {
    runs,
    items,
    summary: {
      totalRuns: runs.length,
      passed: runs.filter((run) => run.status === "passed").length,
      failed: runs.filter((run) => run.status === "failed").length,
      timeout: runs.filter((run) => run.status === "timeout").length,
      error: runs.filter((run) => run.status === "error").length,
      totalItems: items.length,
      truncated: false
    }
  };
}

function discoverRuntimeCommands(root: string, kinds: RuntimeEvidenceKind[], timeoutMs: number): RuntimeCommandSpec[] {
  const packageJson = readPackageJson(root);
  const scripts = packageJson?.scripts ?? {};
  return kinds.flatMap((kind) => {
    if (kind === "command") return [];
    const script = scriptNameForKind(kind, scripts);
    if (!script) return [];
    const npm = npmInvocation(script);
    return [{
      kind,
      command: npm.command,
      args: npm.args,
      label: `npm run ${script}`,
      timeoutMs
    }];
  });
}

function executeRuntimeCommand(root: string, spec: RuntimeCommandSpec): RuntimeEvidenceRunInput {
  const started = Date.now();
  const result = spawnSync(spec.command, spec.args, { cwd: root, encoding: "utf8", timeout: spec.timeoutMs, windowsHide: true, shell: false });
  const durationMs = Date.now() - started;
  const output = redactOutput(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  const status = result.error && `${result.error.message}`.includes("ETIMEDOUT") ? "timeout" : result.error ? "error" : result.status === 0 ? "passed" : "failed";
  const sample = bounded(output, 4000);
  const items = parseRuntimeItems(spec.kind, sample);
  const outputHash = `sha256:${createHash("sha256").update(output).digest("hex")}`;
  return {
    kind: spec.kind,
    command: spec.label,
    status,
    exitCode: typeof result.status === "number" ? result.status : null,
    durationMs,
    outputSummary: summarizeRuntimeOutput(spec.kind, status, sample, outputHash),
    items: items.length > 0 ? items : [{
      kind: spec.kind === "test" ? "test_result" : spec.kind === "lint" ? "lint_result" : spec.kind === "typecheck" ? "typecheck_result" : "build_result",
      severity: status === "passed" ? "info" : "error",
      message: summarizeRuntimeOutput(spec.kind, status, sample, outputHash)
    }]
  };
}

function parseRuntimeItems(kind: RuntimeEvidenceKind, output: string): RuntimeEvidenceRunInput["items"] {
  const items: RuntimeEvidenceRunInput["items"] = [];
  const filePattern = /([A-Za-z0-9_.\/-]+\.[A-Za-z0-9]+)(?::|\()(\d+)?(?:,|:)?(\d+)?\)?[:\s-]+(.+)/g;
  for (const match of output.matchAll(filePattern)) {
    const filePath = normalizeOutputPath(match[1] ?? "");
    if (!filePath || filePath.startsWith("../")) continue;
    const message = match[4]?.trim();
    if (!message) continue;
    items.push({
      kind: kind === "test" ? "test_result" : kind === "lint" ? "lint_result" : kind === "typecheck" ? "typecheck_result" : "build_result",
      filePath,
      severity: /warning/i.test(message) ? "warning" : /pass(ed)?/i.test(message) ? "info" : "error",
      message,
      startLine: match[2] ? Number(match[2]) : null,
      endLine: match[2] ? Number(match[2]) : null
    });
    if (items.length >= 50) break;
  }
  return items;
}

function readPackageJson(root: string): { scripts?: Record<string, string> } | null {
  const file = path.join(root, "package.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as { scripts?: Record<string, string> };
  } catch {
    return null;
  }
}

function scriptNameForKind(kind: RuntimeEvidenceKind, scripts: Record<string, string>): string | null {
  const candidates: Record<RuntimeEvidenceKind, string[]> = {
    build: ["build"],
    test: ["test", "test:unit"],
    lint: ["lint"],
    typecheck: ["typecheck", "type-check", "check-types"],
    command: []
  };
  return candidates[kind].find((script) => Object.prototype.hasOwnProperty.call(scripts, script)) ?? null;
}

function npmInvocation(script: string): { command: string; args: string[] } {
  const cli = findNpmCli();
  if (cli) return { command: process.execPath, args: [cli, "run", script, "--silent"] };
  return { command: "npm", args: ["run", script, "--silent"] };
}

function findNpmCli(): string | null {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
    ...(process.env.PATH?.split(path.delimiter).map((dir) => path.join(dir, "node_modules", "npm", "bin", "npm-cli.js")) ?? [])
  ].filter((value): value is string => Boolean(value));
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function redactOutput(value: string): string {
  return value
    .replace(/[A-Za-z]:[\\/][^\s'")]+/g, "<path>")
    .replace(/(?:sk|pk|rk|sess|ghp|github_pat|npm)_[A-Za-z0-9_\-]{12,}/g, "<secret>")
    .replaceAll("\\", "/");
}

function bounded(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function summarizeRuntimeOutput(kind: RuntimeEvidenceKind, status: RuntimeEvidenceRunInput["status"], sample: string, outputHash: string): string {
  const prefix = `${kind} ${status}`;
  const first = sample.split(/(?<=[.!?])\s+/)[0] ?? "";
  return bounded(`${prefix}${first ? `: ${first}` : ""} (${outputHash})`, 500);
}

function normalizeOutputPath(value: string): string | null {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (!normalized || normalized.startsWith("/") || normalized.includes("../") || /^[A-Za-z]:\//.test(normalized)) return null;
  return normalized;
}
