import { pathToFileURL } from "node:url";
import { Command, CommanderError } from "commander";
import { printResult } from "./output.js";
import { cmdAgentRun } from "./commands/agent.js";
import { cmdAgentsInstall, cmdAgentsList } from "./commands/agents.js";
import { cmdDoctor } from "./commands/doctor.js";
import { cmdDiagnostics } from "./commands/diagnostics.js";
import { cmdDiff } from "./commands/diff.js";
import { cmdDecisionAdd, cmdDecisionGet, cmdDecisionList, cmdDecisionStatus } from "./commands/decisions.js";
import { cmdDuplicates } from "./commands/duplicates.js";
import { cmdEvidenceList, cmdEvidenceRun } from "./commands/evidence.js";
import { cmdFeedback } from "./commands/feedback.js";
import { cmdFrame } from "./commands/frame.js";
import { cmdHead } from "./commands/head.js";
import { cmdIndex } from "./commands/index.js";
import { cmdInit } from "./commands/init.js";
import { cmdQuery } from "./commands/query.js";
import { cmdRefresh } from "./commands/refresh.js";
import { cmdRender } from "./commands/render.js";
import { cmdScan } from "./commands/scan.js";
import { toErrorPayload } from "../shared/errors.js";
import { VERSION } from "../shared/version.js";
import type { CliResult } from "../shared/types.js";

export async function runCli(argv: string[], cwd = process.cwd()): Promise<number> {
  let exitCode = 0;
  const program = new Command();
  program
    .name("pmem")
    .description("Codex Project Memory CLI")
    .version(VERSION)
    .option("--json", "emit compact JSON")
    .showHelpAfterError()
    .exitOverride();

  program
    .command("init")
    .description("initialize project memory")
    .option("--force", "overwrite generated config when allowed")
    .option("--json", "emit compact JSON")
    .action(async (options: { force?: boolean; json?: boolean }) => {
      const result = await cmdInit({ cwd, force: Boolean(options.force) });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  program
    .command("doctor")
    .description("diagnose project memory")
    .option("--json", "emit compact JSON")
    .action(async (options: { json?: boolean }) => {
      const result = await cmdDoctor({ cwd });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  program
    .command("head")
    .description("show compact memory state")
    .option("--json", "emit compact JSON")
    .action(async (options: { json?: boolean }) => {
      const result = await cmdHead({ cwd });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  program
    .command("scan")
    .description("scan project files")
    .option("--json", "emit compact JSON")
    .action(async (options: { json?: boolean }) => {
      const result = await cmdScan({ cwd });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  program
    .command("index")
    .description("index project files")
    .option("--changed", "index changed files only")
    .option("--json", "emit compact JSON")
    .action(async (options: { changed?: boolean; json?: boolean }) => {
      const result = await cmdIndex({ cwd, changedOnly: Boolean(options.changed) });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  program
    .command("render")
    .description("render current memory frame")
    .option("--frame <frame>", "current|overview|modules|duplicates|risks")
    .option("--no-png", "disable best-effort PNG export")
    .option("--json", "emit compact JSON")
    .action(async (options: { frame?: string; png?: boolean; json?: boolean }) => {
      const result = await cmdRender({ cwd, frame: options.frame, png: options.png });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  program
    .command("frame")
    .description("show registered frame metadata")
    .argument("<frame>", "current|overview|modules|duplicates|risks")
    .option("--json", "emit compact JSON")
    .action(async (frame: string, options: { json?: boolean }) => {
      const result = await cmdFrame({ cwd, frame });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  program
    .command("diagnostics")
    .description("run compiler-assisted diagnostics")
    .option("--language <id>", "language id filter")
    .option("--changed", "prefer changed files when available")
    .option("--no-install", "do not install missing user-space diagnostic tools")
    .option("--json", "emit compact JSON")
    .action(async (options: { language?: string; changed?: boolean; install?: boolean; json?: boolean }) => {
      const result = await cmdDiagnostics({ cwd, language: options.language, changed: Boolean(options.changed), install: options.install });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  program
    .command("diff")
    .description("diff project memory snapshots")
    .option("--from <ref>", "snapshot ref", "previous")
    .option("--to <ref>", "snapshot ref", "current")
    .option("--json", "emit compact JSON")
    .action(async (options: { from?: string; to?: string; json?: boolean }) => {
      const result = await cmdDiff({ cwd, from: options.from, to: options.to });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  const evidence = program.command("evidence").description("run or list bounded runtime evidence");
  evidence
    .command("run")
    .description("run a project build/test/lint/typecheck script and import bounded evidence")
    .option("--kind <kind>", "build|test|lint|typecheck", "test")
    .option("--all", "run all discovered evidence scripts")
    .option("--json", "emit compact JSON")
    .action(async (options: { kind?: string; all?: boolean; json?: boolean }) => {
      const result = await cmdEvidenceRun({ cwd, kind: options.kind, all: Boolean(options.all) });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  const decisions = program.command("decisions").description("manage compact invalidable architecture decisions");
  decisions
    .command("add")
    .requiredOption("--title <title>", "decision title")
    .requiredOption("--summary <summary>", "decision summary")
    .option("--rationale <text>", "decision rationale")
    .option("--module <moduleId>", "module id")
    .option("--file <path>", "relative file path")
    .option("--symbol <fqName>", "symbol fq name")
    .option("--json", "emit compact JSON")
    .action(async (options: { title?: string; summary?: string; rationale?: string; module?: string; file?: string; symbol?: string; json?: boolean }) => {
      const result = await cmdDecisionAdd({ cwd, title: options.title, summary: options.summary, rationale: options.rationale, moduleId: options.module, filePath: options.file, symbolFqName: options.symbol });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });
  decisions
    .command("list")
    .option("--status <status>", "active|stale|contradicted")
    .option("--json", "emit compact JSON")
    .action(async (options: { status?: string; json?: boolean }) => {
      const result = await cmdDecisionList({ cwd, status: options.status });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });
  decisions
    .command("get")
    .argument("<idOrTitle>", "decision id or title")
    .option("--json", "emit compact JSON")
    .action(async (idOrTitle: string, options: { json?: boolean }) => {
      const result = await cmdDecisionGet({ cwd, idOrTitle });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });
  decisions
    .command("status")
    .argument("<id>", "decision id")
    .requiredOption("--status <status>", "active|stale|contradicted")
    .option("--reason <reason>", "status reason")
    .option("--json", "emit compact JSON")
    .action(async (id: string, options: { status?: string; reason?: string; json?: boolean }) => {
      const result = await cmdDecisionStatus({ cwd, id: Number(id), status: options.status ?? "", reason: options.reason });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  program
    .command("feedback")
    .description("record bounded feedback on an evidence key")
    .requiredOption("--evidence <key>", "evidence key such as file:src/a.ts")
    .requiredOption("--signal <signal>", "useful|not_useful|accepted|rejected|opened")
    .option("--intent <intent>", "optional feedback intent")
    .option("--json", "emit compact JSON")
    .action(async (options: { evidence?: string; signal?: string; intent?: string; json?: boolean }) => {
      const result = await cmdFeedback({ cwd, evidenceKey: options.evidence, signal: options.signal, intent: options.intent });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });
  evidence
    .command("list")
    .description("list recently imported runtime evidence")
    .option("--json", "emit compact JSON")
    .action(async (options: { json?: boolean }) => {
      const result = await cmdEvidenceList({ cwd });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  program
    .command("query")
    .description("retrieve compact project memory context")
    .argument("<intent>", "task intent")
    .option("--max-files <n>", "maximum files")
    .option("--max-symbols <n>", "maximum symbols")
    .option("--max-warnings <n>", "maximum warnings")
    .option("--visual", "include current frame reference")
    .option("--json", "emit compact JSON")
    .action(async (intent: string, options: { maxFiles?: string; maxSymbols?: string; maxWarnings?: string; visual?: boolean; json?: boolean }) => {
      const result = await cmdQuery({
        cwd,
        intent,
        maxFiles: options.maxFiles ? Number(options.maxFiles) : undefined,
        maxSymbols: options.maxSymbols ? Number(options.maxSymbols) : undefined,
        maxWarnings: options.maxWarnings ? Number(options.maxWarnings) : undefined,
        visual: Boolean(options.visual)
      });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  program
    .command("duplicates")
    .description("check duplicate risk before creating an artifact")
    .argument("<intent>", "task intent")
    .requiredOption("--kind <kind>", "artifact kind")
    .option("--module <moduleId>", "module id")
    .option("--name <proposedName>", "proposed artifact name")
    .option("--json", "emit compact JSON")
    .action(async (intent: string, options: { kind?: string; module?: string; name?: string; json?: boolean }) => {
      const result = await cmdDuplicates({ cwd, intent, kind: options.kind, moduleId: options.module, proposedName: options.name });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  program
    .command("refresh")
    .description("changed-only refresh and render current frame")
    .option("--changed-only", "accepted for clarity; refresh is changed-only by default")
    .option("--no-render", "skip render")
    .option("--reason <reason>", "refresh reason", "manual")
    .option("--json", "emit compact JSON")
    .action(async (options: { render?: boolean; reason?: string; json?: boolean }) => {
      const result = await cmdRefresh({ cwd, render: options.render, reason: options.reason });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  const agent = program.command("agent").description("run the project memory orchestrator");
  agent
    .command("run")
    .description("orchestrate project memory for a task intent")
    .argument("<intent>", "task intent")
    .option("--phase <phase>", "pre_task|pre_create|post_change|review|orient", "pre_task")
    .option("--kind <kind>", "artifact kind for duplicate checks")
    .option("--module <moduleId>", "module id for duplicate checks")
    .option("--name <proposedName>", "proposed artifact name")
    .option("--no-init", "do not initialize missing project memory")
    .option("--no-refresh", "do not refresh dirty or stale project memory")
    .option("--no-render", "skip render during refresh")
    .option("--json", "emit compact JSON")
    .action(async (intent: string, options: { phase?: string; kind?: string; module?: string; name?: string; init?: boolean; refresh?: boolean; render?: boolean; json?: boolean }) => {
      const result = await cmdAgentRun({
        cwd,
        intent,
        phase: options.phase,
        kind: options.kind,
        moduleId: options.module,
        proposedName: options.name,
        init: options.init,
        refresh: options.refresh,
        render: options.render
      });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  const agents = program.command("agents").description("manage optional read-only Codex subagent templates");
  agents
    .command("install")
    .description("install optional project subagent templates")
    .option("--scope <scope>", "install scope", "project")
    .option("--force", "overwrite existing templates")
    .option("--json", "emit compact JSON")
    .action(async (options: { scope?: string; force?: boolean; json?: boolean }) => {
      const result = await cmdAgentsInstall({ cwd, scope: options.scope, force: Boolean(options.force) });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });
  agents
    .command("list")
    .description("list optional project subagent templates")
    .option("--json", "emit compact JSON")
    .action(async (options: { json?: boolean }) => {
      const result = await cmdAgentsList({ cwd });
      exitCode = printCommandResult(result, Boolean(options.json ?? program.opts<{ json?: boolean }>().json));
    });

  try {
    await program.parseAsync(argv, { from: "user" });
    return exitCode;
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode;
    }

    const payload = toErrorPayload(error);
    printResult({ ok: false, error: payload, warnings: [] }, { json: argv.includes("--json") });
    return payload.code === "NOT_INITIALIZED" || payload.code === "FRAME_NOT_FOUND" ? 2 : 1;
  }
}

function printCommandResult(result: CliResult, json: boolean): number {
  printResult(result, { json });
  if (result.ok) {
    return 0;
  }
  return result.error?.code === "NOT_INITIALIZED" || result.error?.code === "FRAME_NOT_FOUND" ? 2 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
