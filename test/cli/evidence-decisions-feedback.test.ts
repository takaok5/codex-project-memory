import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdDecisionAdd, cmdDecisionList, cmdDecisionStatus } from "../../src/cli/commands/decisions.js";
import { cmdEvidenceRun } from "../../src/cli/commands/evidence.js";
import { cmdFeedback } from "../../src/cli/commands/feedback.js";
import { cmdInit } from "../../src/cli/commands/init.js";

describe("evidence, decisions and feedback CLI", () => {
  it("imports bounded runtime evidence and manages decisions/feedback", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-cli-evidence-"));
    try {
      mkdirSync(path.join(root, "src"), { recursive: true });
      writeFileSync(path.join(root, "src", "app.ts"), "export const app = 1;\n");
      writeFileSync(path.join(root, "package.json"), JSON.stringify({
        name: "fixture",
        scripts: {
          test: "node -e \"console.error('src/app.ts:2:1 test failure'); process.exit(1)\""
        }
      }));
      await cmdInit({ cwd: root });

      const evidence = await cmdEvidenceRun({ cwd: root, kind: "test" });
      expect(evidence).toMatchObject({ ok: true, data: { summary: { totalRuns: 1, failed: 1 } } });
      expect(JSON.stringify(evidence)).not.toContain(root);

      const decision = await cmdDecisionAdd({ cwd: root, title: "app-boundary", summary: "App owns startup.", filePath: "src/app.ts" });
      expect(decision.ok).toBe(true);
      const listed = await cmdDecisionList({ cwd: root });
      expect(listed.data?.decisions[0]).toMatchObject({ title: "app-boundary", status: "active" });
      const status = await cmdDecisionStatus({ cwd: root, id: decision.data!.id, status: "stale", reason: "test reason" });
      expect(status.ok).toBe(true);

      const feedback = await cmdFeedback({ cwd: root, evidenceKey: "file:src/app.ts", signal: "useful", intent: "PRIVATE_MARKER" });
      expect(feedback).toMatchObject({ ok: true, data: { evidenceKey: "file:src/app.ts", signal: "useful" } });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
