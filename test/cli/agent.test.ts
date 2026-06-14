import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { cmdAgentRun } from "../../src/cli/commands/agent.js";
import { runCli } from "../../src/cli/pmem.js";

describe("agent CLI command", () => {
  it("runs the project agent and returns a CliResult wrapper", async () => {
    const root = fixtureRoot("pmem-cli-agent-");
    try {
      const result = await cmdAgentRun({ cwd: root, intent: "access subscription suspended" });

      expect(result).toMatchObject({
        ok: true,
        data: {
          version: 2,
          status: "refreshed",
          decision: { verdict: "continue" }
        }
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("is wired through pmem agent run", async () => {
    const root = fixtureRoot("pmem-cli-agent-run-");
    let output = "";
    const out = vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      output += chunk.toString();
      return true;
    });
    try {
      const code = await runCli(["agent", "run", "access subscription suspended", "--json"], root);
      expect(code).toBe(0);
      expect(JSON.parse(output)).toMatchObject({
        ok: true,
        data: {
          version: 2,
          status: "refreshed"
        }
      });
    } finally {
      out.mockRestore();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns high duplicate risk through artifact flags", async () => {
    const root = fixtureRoot("pmem-cli-agent-dup-");
    try {
      const result = await cmdAgentRun({
        cwd: root,
        intent: "AccessValidationService / verifica diritto accesso",
        phase: "pre_create",
        kind: "service",
        moduleId: "access",
        proposedName: "AccessValidationService"
      });

      expect(result).toMatchObject({
        ok: true,
        data: {
          status: "blocked",
          duplicates: { risk: "high", verdict: "extend_existing_artifact" },
          decision: { verdict: "extend_existing_artifact" }
        }
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("honors no-init, no-refresh and no-render flags", async () => {
    const missing = mkdtempSync(path.join(tmpdir(), "pmem-cli-agent-missing-"));
    const root = fixtureRoot("pmem-cli-agent-flags-");
    try {
      await expect(cmdAgentRun({ cwd: missing, intent: "access subscription suspended", init: false })).resolves.toMatchObject({
        ok: true,
        data: { status: "blocked", decision: { verdict: "blocked" } }
      });

      const rendered = await cmdAgentRun({ cwd: root, intent: "access subscription suspended", render: false });
      expect(rendered).toMatchObject({
        ok: true,
        data: {
          refresh: { render: { skipped: true } }
        }
      });

      const noRefresh = await cmdAgentRun({ cwd: root, intent: "access subscription suspended", refresh: false });
      expect(noRefresh.data?.actions).toEqual(expect.arrayContaining([expect.objectContaining({ name: "refresh", status: "skipped", reason: "allowRefresh=false" })]));
    } finally {
      rmSync(missing, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function fixtureRoot(prefix: string): string {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
  return root;
}
