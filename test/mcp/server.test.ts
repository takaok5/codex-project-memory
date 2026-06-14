import { describe, expect, it } from "vitest";
import { createMcpServer, MEMORY_TOOL_NAMES } from "../../src/mcp/server.js";
import { resolveMcpProjectCwd } from "../../src/mcp/project-env.js";

describe("MCP server", () => {
  it("can be constructed with the closed tool registry", () => {
    const server = createMcpServer({ cwd: process.cwd() });
    expect(server).toBeTruthy();
    expect(MEMORY_TOOL_NAMES).toHaveLength(6);
  });

  it("resolves project cwd from Codex/workspace environment before fallback", () => {
    expect(resolveMcpProjectCwd({ CODEX_WORKSPACE_ROOT: process.cwd() } as NodeJS.ProcessEnv, "C:\\")).toBe(process.cwd());
  });
});
