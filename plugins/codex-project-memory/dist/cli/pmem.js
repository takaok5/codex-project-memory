import { pathToFileURL } from "node:url";
import { Command, CommanderError } from "commander";
import { printResult } from "./output.js";
import { cmdAgentRun } from "./commands/agent.js";
import { cmdAgentsInstall, cmdAgentsList } from "./commands/agents.js";
import { cmdDoctor } from "./commands/doctor.js";
import { cmdDiagnostics } from "./commands/diagnostics.js";
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
export async function runCli(argv, cwd = process.cwd()) {
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
        .action(async (options) => {
        const result = await cmdInit({ cwd, force: Boolean(options.force) });
        exitCode = printCommandResult(result, Boolean(options.json ?? program.opts().json));
    });
    program
        .command("doctor")
        .description("diagnose project memory")
        .option("--json", "emit compact JSON")
        .action(async (options) => {
        const result = await cmdDoctor({ cwd });
        exitCode = printCommandResult(result, Boolean(options.json ?? program.opts().json));
    });
    program
        .command("head")
        .description("show compact memory state")
        .option("--json", "emit compact JSON")
        .action(async (options) => {
        const result = await cmdHead({ cwd });
        exitCode = printCommandResult(result, Boolean(options.json ?? program.opts().json));
    });
    program
        .command("scan")
        .description("scan project files")
        .option("--json", "emit compact JSON")
        .action(async (options) => {
        const result = await cmdScan({ cwd });
        exitCode = printCommandResult(result, Boolean(options.json ?? program.opts().json));
    });
    program
        .command("index")
        .description("index project files")
        .option("--changed", "index changed files only")
        .option("--json", "emit compact JSON")
        .action(async (options) => {
        const result = await cmdIndex({ cwd, changedOnly: Boolean(options.changed) });
        exitCode = printCommandResult(result, Boolean(options.json ?? program.opts().json));
    });
    program
        .command("render")
        .description("render current memory frame")
        .option("--frame <frame>", "current|overview|modules|duplicates|risks")
        .option("--no-png", "disable best-effort PNG export")
        .option("--json", "emit compact JSON")
        .action(async (options) => {
        const result = await cmdRender({ cwd, frame: options.frame, png: options.png });
        exitCode = printCommandResult(result, Boolean(options.json ?? program.opts().json));
    });
    program
        .command("frame")
        .description("show registered frame metadata")
        .argument("<frame>", "current|overview|modules|duplicates|risks")
        .option("--json", "emit compact JSON")
        .action(async (frame, options) => {
        const result = await cmdFrame({ cwd, frame });
        exitCode = printCommandResult(result, Boolean(options.json ?? program.opts().json));
    });
    program
        .command("diagnostics")
        .description("run compiler-assisted diagnostics")
        .option("--language <id>", "language id filter")
        .option("--changed", "prefer changed files when available")
        .option("--no-install", "do not install missing user-space diagnostic tools")
        .option("--json", "emit compact JSON")
        .action(async (options) => {
        const result = await cmdDiagnostics({ cwd, language: options.language, changed: Boolean(options.changed), install: options.install });
        exitCode = printCommandResult(result, Boolean(options.json ?? program.opts().json));
    });
    program
        .command("diff")
        .description("diff project memory snapshots")
        .option("--from <ref>", "snapshot ref", "previous")
        .option("--to <ref>", "snapshot ref", "current")
        .option("--json", "emit compact JSON")
        .action(async (options) => {
        const result = await cmdDiff({ cwd, from: options.from, to: options.to });
        exitCode = printCommandResult(result, Boolean(options.json ?? program.opts().json));
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
        .action(async (intent, options) => {
        const result = await cmdQuery({
            cwd,
            intent,
            maxFiles: options.maxFiles ? Number(options.maxFiles) : undefined,
            maxSymbols: options.maxSymbols ? Number(options.maxSymbols) : undefined,
            maxWarnings: options.maxWarnings ? Number(options.maxWarnings) : undefined,
            visual: Boolean(options.visual)
        });
        exitCode = printCommandResult(result, Boolean(options.json ?? program.opts().json));
    });
    program
        .command("duplicates")
        .description("check duplicate risk before creating an artifact")
        .argument("<intent>", "task intent")
        .requiredOption("--kind <kind>", "artifact kind")
        .option("--module <moduleId>", "module id")
        .option("--name <proposedName>", "proposed artifact name")
        .option("--json", "emit compact JSON")
        .action(async (intent, options) => {
        const result = await cmdDuplicates({ cwd, intent, kind: options.kind, moduleId: options.module, proposedName: options.name });
        exitCode = printCommandResult(result, Boolean(options.json ?? program.opts().json));
    });
    program
        .command("refresh")
        .description("changed-only refresh and render current frame")
        .option("--changed-only", "accepted for clarity; refresh is changed-only by default")
        .option("--no-render", "skip render")
        .option("--reason <reason>", "refresh reason", "manual")
        .option("--json", "emit compact JSON")
        .action(async (options) => {
        const result = await cmdRefresh({ cwd, render: options.render, reason: options.reason });
        exitCode = printCommandResult(result, Boolean(options.json ?? program.opts().json));
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
        .action(async (intent, options) => {
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
        exitCode = printCommandResult(result, Boolean(options.json ?? program.opts().json));
    });
    const agents = program.command("agents").description("manage optional read-only Codex subagent templates");
    agents
        .command("install")
        .description("install optional project subagent templates")
        .option("--scope <scope>", "install scope", "project")
        .option("--force", "overwrite existing templates")
        .option("--json", "emit compact JSON")
        .action(async (options) => {
        const result = await cmdAgentsInstall({ cwd, scope: options.scope, force: Boolean(options.force) });
        exitCode = printCommandResult(result, Boolean(options.json ?? program.opts().json));
    });
    agents
        .command("list")
        .description("list optional project subagent templates")
        .option("--json", "emit compact JSON")
        .action(async (options) => {
        const result = await cmdAgentsList({ cwd });
        exitCode = printCommandResult(result, Boolean(options.json ?? program.opts().json));
    });
    try {
        await program.parseAsync(argv, { from: "user" });
        return exitCode;
    }
    catch (error) {
        if (error instanceof CommanderError) {
            return error.exitCode;
        }
        const payload = toErrorPayload(error);
        printResult({ ok: false, error: payload, warnings: [] }, { json: argv.includes("--json") });
        return payload.code === "NOT_INITIALIZED" || payload.code === "FRAME_NOT_FOUND" ? 2 : 1;
    }
}
function printCommandResult(result, json) {
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
//# sourceMappingURL=pmem.js.map