import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runProjectAgent } from "../../src/agents/project-agent.js";
import { cmdFeedback } from "../../src/cli/commands/feedback.js";
import { getMemoryPaths } from "../../src/runtime/memory-paths.js";
import { openMemoryDb } from "../../src/store/sqlite.js";

describe("no raw conversational memory", () => {
  it("does not persist raw intent markers in retrieval logs or feedback", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-no-raw-"));
    const marker = "PRIVATE_CHAT_MARKER_123";
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      await runProjectAgent({ intent: `access subscription ${marker}` }, { cwd: root });
      await cmdFeedback({ cwd: root, evidenceKey: "file:src/access/access.service.ts", signal: "useful", intent: marker });

      const db = openMemoryDb(getMemoryPaths(root));
      try {
        const rows = db.prepare("SELECT intent, output_json FROM retrieval_logs").all();
        const feedback = db.prepare("SELECT intent FROM evidence_feedback").all();
        const text = JSON.stringify([rows, feedback]);
        expect(text).not.toContain(marker);
      } finally {
        db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
