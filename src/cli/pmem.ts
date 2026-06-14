import { pathToFileURL } from "node:url";
import { Command, CommanderError } from "commander";
import { printResult } from "./output.js";
import { toErrorPayload } from "../shared/errors.js";
import { VERSION } from "../shared/version.js";

export async function runCli(argv: string[], cwd = process.cwd()): Promise<number> {
  void cwd;

  const program = new Command();
  program
    .name("pmem")
    .description("Codex Project Memory CLI")
    .version(VERSION)
    .showHelpAfterError()
    .exitOverride();

  try {
    await program.parseAsync(argv, { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode;
    }

    const payload = toErrorPayload(error);
    printResult({ ok: false, error: payload, warnings: [] }, { json: argv.includes("--json") });
    return payload.code === "NOT_INITIALIZED" || payload.code === "FRAME_NOT_FOUND" ? 2 : 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
