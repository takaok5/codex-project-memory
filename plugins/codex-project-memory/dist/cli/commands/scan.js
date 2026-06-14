import { resolveRuntimeContext } from "../../runtime/context.js";
import { toErrorPayload } from "../../shared/errors.js";
import { scanProjectFiles } from "../../indexer/scan.js";
export async function cmdScan(options) {
    try {
        const ctx = resolveRuntimeContext({ cwd: options.cwd });
        const files = await scanProjectFiles(ctx.projectRoot, ctx.config);
        return {
            ok: true,
            data: {
                files: {
                    scanned: files.length,
                    included: files.length,
                    excluded: 0,
                    tooLarge: files.filter((file) => file.sizeBytes > ctx.config.scan.maxFileBytes).length,
                    unsupported: 0
                },
                roots: ctx.config.scan.include,
                warnings: []
            },
            warnings: []
        };
    }
    catch (error) {
        return { ok: false, error: toErrorPayload(error), warnings: [] };
    }
}
//# sourceMappingURL=scan.js.map