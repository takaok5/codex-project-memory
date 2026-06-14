import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { handleMemoryAgent } from "../../src/mcp/tools/agent.js";

describe("memory.agent tool", () => {
  it("works before init and returns typed output", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-mcp-agent-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      const output = await handleMemoryAgent({ intent: "access subscription suspended" }, { cwd: root });

      expect(output).toMatchObject({
        version: 2,
        status: "refreshed",
        refresh: { changedOnly: true },
        decision: { verdict: "continue" }
      });
      expect(output).not.toHaveProperty("ok");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("maps duplicate checks through the orchestrator", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-mcp-agent-dup-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      const output = await handleMemoryAgent({
        intent: "AccessValidationService / verifica diritto accesso",
        phase: "pre_create",
        artifact: { kind: "service", moduleId: "access", proposedName: "AccessValidationService" }
      }, { cwd: root });

      expect(output).toMatchObject({
        status: "blocked",
        duplicates: { risk: "high" },
        decision: { verdict: "extend_existing_artifact" }
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
