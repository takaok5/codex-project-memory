import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runProjectAgent } from "../../src/agents/project-agent.js";

describe("project memory agent", () => {
  it("initializes missing memory, refreshes and renders by default", async () => {
    const root = fixtureRoot("pmem-agent-init-");
    try {
      const output = await runProjectAgent({ intent: "access subscription suspended" }, { cwd: root });

      expect(output).toMatchObject({
        version: 2,
        status: "refreshed",
        route: { defaultDeny: true, intentKind: "implementation" },
        refresh: { changedOnly: true, render: { skipped: false } },
        impact: { blastRadius: expect.any(String) },
        curation: { mode: "writer_gate" },
        conflicts: { status: "clear" },
        decision: { verdict: "continue" }
      });
      expect(output.actions).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "router", status: "completed" }),
        expect.objectContaining({ name: "init", status: "completed" }),
        expect.objectContaining({ name: "refresh", status: "completed" }),
        expect.objectContaining({ name: "query", status: "completed" }),
        expect.objectContaining({ name: "impact", status: "completed" }),
        expect.objectContaining({ name: "curator", status: "completed" }),
        expect.objectContaining({ name: "conflict", status: "completed" }),
        expect.objectContaining({ name: "compressor", status: "completed" })
      ]));
      expect(output.query?.contextPack.budget.defaultDeny).toBe(true);
      expect(output.query?.contextPack.evidence.length).toBeGreaterThan(0);
      expect(output.head.currentFrame?.svg).toBe(".codex/memory/current.svg");
      expect(output.decision.filesToOpen.every((item) => !path.isAbsolute(item) && !item.includes("\\"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("blocks when memory is missing and init is disabled", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-agent-no-init-"));
    try {
      const output = await runProjectAgent({ intent: "access subscription suspended", allowInit: false }, { cwd: root });

      expect(output).toMatchObject({
        status: "blocked",
        decision: {
          verdict: "blocked",
          nextCommands: ["pmem init --json"]
        }
      });
      expect(output.actions).toContainEqual({ name: "init", status: "blocked", reason: "allowInit=false" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("blocks new artifacts on high duplicate risk", async () => {
    const root = fixtureRoot("pmem-agent-duplicate-");
    try {
      const output = await runProjectAgent({
        intent: "AccessValidationService / verifica diritto accesso",
        phase: "pre_create",
        artifact: { kind: "service", moduleId: "access", proposedName: "AccessValidationService" }
      }, { cwd: root });

      expect(output).toMatchObject({
        status: "blocked",
        route: { intentKind: "pre_create", agents: expect.arrayContaining(["duplicate-sentinel", "conflict-arbiter"]) },
        duplicates: { risk: "high", verdict: "extend_existing_artifact" },
        conflicts: { status: "conflict" },
        decision: { verdict: "extend_existing_artifact" }
      });
      expect(output.decision.verdict).not.toBe("create_new_artifact");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns refresh and diff for post-change phase", async () => {
    const root = fixtureRoot("pmem-agent-post-");
    try {
      await runProjectAgent({ intent: "bootstrap memory" }, { cwd: root });
      const output = await runProjectAgent({ intent: "access subscription suspended", phase: "post_change" }, { cwd: root });

      expect(output.refresh).toBeDefined();
      expect(output.diff).toBeDefined();
      expect(output.actions).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "refresh", status: "completed" }),
        expect.objectContaining({ name: "diff", status: "completed" }),
        expect.objectContaining({ name: "runtime-evidence", status: "completed" })
      ]));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns frame information for orient phase", async () => {
    const root = fixtureRoot("pmem-agent-orient-");
    try {
      const output = await runProjectAgent({ intent: "show architecture map", phase: "orient" }, { cwd: root });

      expect(output.frame).toMatchObject({ frame: "current", svg: ".codex/memory/current.svg", map: ".codex/memory/current.map.json" });
      expect(output.actions).toEqual(expect.arrayContaining([expect.objectContaining({ name: "frame", status: "completed" })]));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("validates pre_create artifact input", async () => {
    const root = fixtureRoot("pmem-agent-invalid-");
    try {
      await expect(runProjectAgent({ intent: "create access validator", phase: "pre_create" }, { cwd: root })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function fixtureRoot(prefix: string): string {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
  return root;
}
