import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { cmdDiff } from "../../src/cli/commands/diff.js";

describe("memory snapshots", () => {
  it("reports compact empty diff when previous snapshot is missing", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-snapshot-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      await cmdInit({ cwd: root });
      await cmdIndex({ cwd: root });
      const diff = await cmdDiff({ cwd: root });
      expect(diff).toMatchObject({
        ok: true,
        data: {
          from: "previous",
          to: "current",
          changedFiles: [],
          addedFiles: [],
          removedFiles: [],
          changedWarnings: { added: [], resolved: [] }
        }
      });
      expect(diff.warnings).toContain("snapshot_missing: previous");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
