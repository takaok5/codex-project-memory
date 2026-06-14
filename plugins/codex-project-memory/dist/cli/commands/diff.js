import { diffMemorySnapshots, readMemorySnapshot } from "../../runtime/snapshots.js";
import { resolveRuntimeContext } from "../../runtime/context.js";
import { toErrorPayload } from "../../shared/errors.js";
export async function cmdDiff(options) {
    try {
        const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
        const db = ctx.db;
        try {
            const fromRef = options.from ?? "previous";
            const toRef = options.to ?? "current";
            const from = readMemorySnapshot(ctx, fromRef);
            const to = readMemorySnapshot(ctx, toRef);
            const diff = diffMemorySnapshots(from.snapshot, to.snapshot);
            return { ok: true, data: { from: fromRef, to: toRef, ...diff }, warnings: [from.warning, to.warning].filter(Boolean) };
        }
        finally {
            db.close();
        }
    }
    catch (error) {
        return { ok: false, error: toErrorPayload(error), warnings: [] };
    }
}
//# sourceMappingURL=diff.js.map