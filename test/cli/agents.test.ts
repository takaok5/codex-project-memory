import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdAgentsInstall, cmdAgentsList } from "../../src/cli/commands/agents.js";

describe("agents CLI commands", () => {
  it("installs and lists project templates", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-cli-agents-"));
    try {
      const installed = await cmdAgentsInstall({ cwd: root, scope: "project" });
      expect(installed.ok).toBe(true);
      expect(installed.data?.installed).toContain(".codex/agents/pmem-retriever.toml");
      const skipped = await cmdAgentsInstall({ cwd: root, scope: "project" });
      expect(skipped.ok).toBe(true);
      expect(skipped.data?.skipped).toContain(".codex/agents/pmem-retriever.toml");
      const list = await cmdAgentsList({ cwd: root });
      expect(list.ok).toBe(true);
      expect(list.data?.installed.map((agent) => agent.name)).toContain("pmem_retriever");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
