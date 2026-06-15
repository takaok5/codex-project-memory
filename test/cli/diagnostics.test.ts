import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdDiagnostics } from "../../src/cli/commands/diagnostics.js";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";

describe("diagnostics CLI command", () => {
  it("returns normalized degraded diagnostics without installing tools", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-cli-diagnostics-"));
    try {
      cpSync(path.resolve("test/fixtures/python-fastapi-basic"), root, { recursive: true });
      await cmdInit({ cwd: root });
      await cmdIndex({ cwd: root });

      const diagnostics = await cmdDiagnostics({ cwd: root, language: "python", install: false });
      expect(diagnostics).toMatchObject({
        ok: true,
        data: {
          languages: ["python"],
          summary: { errors: 0, warnings: 0, degradedLanguages: ["python"] }
        }
      });
      expect(diagnostics.data?.diagnostics[0]).toMatchObject({
        language: "python",
        filePath: expect.stringMatching(/\.py$/),
        severity: "info",
        source: "fallback",
        tool: "pyright"
      });

      const changed = await cmdDiagnostics({ cwd: root, changed: true, install: false });
      expect(changed.ok).toBe(true);
      expect(changed.data?.languages).toEqual([]);
      expect(changed.data?.summary.total).toBe(diagnostics.data?.summary.total);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
