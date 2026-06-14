import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { installAgentTemplates, listAgentTemplates, renderAgentTemplate } from "../../src/agents/templates.js";

describe("agent templates", () => {
  it("renders read-only MCP-first templates and installs without overwriting", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-agent-templates-"));
    try {
      expect(renderAgentTemplate("pmem-retriever.toml")).toContain("sandbox_mode = \"read-only\"");
      expect(renderAgentTemplate("pmem-retriever.toml")).toContain("memory.query");
      const first = installAgentTemplates(root);
      expect(first.installed).toHaveLength(3);
      const second = installAgentTemplates(root);
      expect(second.skipped).toHaveLength(3);
      expect(listAgentTemplates(root).installed).toHaveLength(3);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
