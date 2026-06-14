import { pathToFileURL } from "node:url";
import { Command, CommanderError } from "commander";
import { printResult } from "./output.js";
import { cmdAgentsInstall, cmdAgentsList } from "./commands/agents.js";
import { cmdDoctor } from "./commands/doctor.js";
import { cmdDiff } from "./commands/diff.js";
import { cmdDuplicates } from "./commands/duplicates.js";
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
    .command("diff")
    .description("diff project memory snapshots")
    .option("--from <ref>", "snapshot ref", "previous")
    .option("--to <ref>", "snapshot ref", "current")
    .option("--json", "emit compact JSON")
    .action(async (options: { from?: string; to?: string; json?: boolean }) => {
      const result = await cmdDiff({ cwd, from: options.from, to: options.to });
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
