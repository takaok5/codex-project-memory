import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getMemoryPaths } from "../../src/runtime/memory-paths.js";
import { addEvidenceFeedback, addRuntimeEvidenceRun, getEvidenceFeedbackScores, listRuntimeEvidenceItems, listRuntimeEvidenceRuns, upsertArchitectureDecision, listArchitectureDecisions } from "../../src/store/evidence-repository.js";
import { ensureSchema, openMemoryDb } from "../../src/store/sqlite.js";

describe("evidence repository", () => {
  it("stores runtime evidence, decisions and feedback without absolute paths", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-evidence-repo-"));
    try {
      const db = openMemoryDb(getMemoryPaths(root));
      try {
        ensureSchema(db);
        const runtime = addRuntimeEvidenceRun(db, {
          kind: "test",
          command: "npm run test",
          status: "failed",
          exitCode: 1,
          durationMs: 123,
          outputSummary: `Failure at ${root}\\src\\app.ts and /tmp/pmem-evidence-posix/src/app.ts`,
          items: [{ kind: "test_result", filePath: "src/app.ts", severity: "error", message: `failed ${root}\\src\\app.ts and /tmp/pmem-evidence-posix/src/app.ts`, startLine: 2, endLine: 2 }]
        });
        expect(runtime.runId).toBeGreaterThan(0);
        expect(listRuntimeEvidenceRuns(db, 1)[0]).toMatchObject({ kind: "test", status: "failed" });
        expect(JSON.stringify(listRuntimeEvidenceItems(db))).not.toContain(root);
        expect(JSON.stringify(listRuntimeEvidenceItems(db))).not.toContain("/tmp/pmem-evidence-posix");
        expect(JSON.stringify(listRuntimeEvidenceItems(db))).not.toContain("\\");

        const decisionId = upsertArchitectureDecision(db, {
          title: "access-boundary",
          summary: "Access module owns turnstile validation.",
          rationale: "Keeps subscription rules in one module.",
          moduleId: "access",
          filePath: "src/access/access.service.ts"
        });
        expect(decisionId).toBeGreaterThan(0);
        expect(listArchitectureDecisions(db)).toHaveLength(1);

        const feedbackId = addEvidenceFeedback(db, { evidenceKey: "file:src/access/access.service.ts", signal: "useful", intent: "PRIVATE_MARKER", source: "cli" });
        expect(feedbackId).toBeGreaterThan(0);
        expect(getEvidenceFeedbackScores(db).get("file:src/access/access.service.ts")).toBe(1);
      } finally {
        db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
