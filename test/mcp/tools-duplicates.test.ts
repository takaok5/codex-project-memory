import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { handleMemoryDuplicates } from "../../src/mcp/tools/duplicates.js";

describe("memory.duplicates tool", () => {
  it("returns high risk without create_new_artifact", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-mcp-dup-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      await cmdInit({ cwd: root });
      await cmdIndex({ cwd: root });
      const output = await handleMemoryDuplicates(
        { kind: "service", moduleId: "access", proposedName: "AccessValidationService", intent: "AccessValidationService / verifica diritto accesso" },
        { cwd: root }
      );
      expect(output.risk).toBe("high");
      expect(output.verdict).not.toBe("create_new_artifact");
      expect(output.matches[0]).toMatchObject({ name: "AccessService" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
