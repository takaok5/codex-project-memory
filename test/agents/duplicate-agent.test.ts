import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runDuplicateAgent, scoreDuplicateRisk } from "../../src/agents/duplicate-agent.js";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { resolveRuntimeContext } from "../../src/runtime/context.js";
import type { MemoryDb } from "../../src/store/sqlite.js";

describe("duplicate agent", () => {
  it("classifies AccessValidationService as high-risk duplicate of AccessService", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-dup-agent-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      await cmdInit({ cwd: root });
      await cmdIndex({ cwd: root });
      const ctx = resolveRuntimeContext({ cwd: root, openDb: true });
      try {
        const output = runDuplicateAgent(ctx, {
          kind: "service",
          moduleId: "access",
          proposedName: "AccessValidationService",
          intent: "AccessValidationService / verifica diritto accesso"
        });
        expect(output.risk).toBe("high");
        expect(output.verdict).toBe("extend_existing_artifact");
        expect(output.matches[0]).toMatchObject({ name: "AccessService", filePath: "src/access/access.service.ts", moduleId: "access" });
        expect(output.matches[0]?.similarity).toBeGreaterThanOrEqual(0.8);
      } finally {
        (ctx.db as MemoryDb).close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("never returns create_new_artifact for high risk", () => {
    expect(scoreDuplicateRisk({ kind: "service", intent: "x" }, [{ kind: "service", name: "AccessService", similarity: 0.9, reason: "test" }])).toMatchObject({
      risk: "high",
      verdict: "extend_existing_artifact"
    });
  });
});
