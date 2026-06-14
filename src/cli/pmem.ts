import { pathToFileURL } from "node:url";
import { Command, CommanderError } from "commander";
import { printResult } from "./output.js";
import { cmdDoctor } from "./commands/doctor.js";
import { cmdHead } from "./commands/head.js";
import { cmdInit } from "./commands/init.js";
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
