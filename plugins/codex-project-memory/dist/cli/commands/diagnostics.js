import { runDiagnosticAnalysis } from "../../indexer/diagnostic-runner.js";
import { scanProjectFiles } from "../../indexer/scan.js";
import { resolveRuntimeContext } from "../../runtime/context.js";
import { toErrorPayload } from "../../shared/errors.js";
import { listFiles } from "../../store/file-repository.js";
export async function cmdDiagnostics(options) {
    try {
        const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
        const db = ctx.db;
        try {
            const output = runDiagnosticAnalysis(ctx, {
                languages: options.language ? [options.language.toLowerCase()] : undefined,
                filePaths: options.changed ? await changedFilePaths(ctx) : undefined,
                changedOnly: Boolean(options.changed),
                allowInstall: options.install !== false
            });
            return { ok: true, data: output, warnings: [] };
        }
        finally {
            db.close();
        }
    }
    catch (error) {
        return { ok: false, error: toErrorPayload(error), warnings: [] };
    }
}
async function changedFilePaths(ctx) {
    const db = ctx.db;
    const existing = new Map(listFiles(db).map((file) => [file.path, file.hash]));
    const scanned = await scanProjectFiles(ctx.projectRoot, ctx.config);
    return scanned.filter((file) => existing.get(file.path) !== file.hash).map((file) => file.path);
}
//# sourceMappingURL=diagnostics.js.map