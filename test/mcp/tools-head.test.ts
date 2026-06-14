import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { handleMemoryHead } from "../../src/mcp/tools/head.js";

describe("memory.head tool", () => {
  it("works before init and returns typed output", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-mcp-head-"));
    try {
      const output = await handleMemoryHead({}, { cwd: root });
      expect(output).toMatchObject({ status: "not_initialized", memoryRoot: ".codex/memory", visualFrame: null });
      expect(output).not.toHaveProperty("ok");
      expect(output.nextCommands).toContain("pmem init --json");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
