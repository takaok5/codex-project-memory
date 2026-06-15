import { runDiagnosticAnalysis } from "../../indexer/diagnostic-runner.js";
import { scanProjectFiles } from "../../indexer/scan.js";
import { resolveRuntimeContext } from "../../runtime/context.js";
import { toErrorPayload } from "../../shared/errors.js";
import type { CliResult, DiagnosticsOutput } from "../../shared/types.js";
import { listFiles } from "../../store/file-repository.js";
import type { MemoryDb } from "../../store/sqlite.js";

export interface DiagnosticsCliOptions {
  cwd: string;
  language?: string;
  changed?: boolean;
  install?: boolean;
}

export async function cmdDiagnostics(options: DiagnosticsCliOptions): Promise<CliResult<DiagnosticsOutput>> {
  try {
    const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
    const db = ctx.db as MemoryDb;
    try {
      const output = runDiagnosticAnalysis(ctx, {
        languages: options.language ? [options.language.toLowerCase()] : undefined,
        filePaths: options.changed ? await changedFilePaths(ctx) : undefined,
        changedOnly: Boolean(options.changed),
        allowInstall: options.install !== false
      });
      return { ok: true, data: output, warnings: [] };
    } finally {
      db.close();
    }
  } catch (error) {
    return { ok: false, error: toErrorPayload(error), warnings: [] };
  }
}

async function changedFilePaths(ctx: ReturnType<typeof resolveRuntimeContext>): Promise<string[]> {
  const db = ctx.db as MemoryDb;
  const existing = new Map(listFiles(db).map((file) => [file.path, file.hash]));
  const scanned = await scanProjectFiles(ctx.projectRoot, ctx.config);
  return scanned.filter((file) => existing.get(file.path) !== file.hash).map((file) => file.path);
}
