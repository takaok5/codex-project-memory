import { describe, expect, it } from "vitest";
import { createMcpServer, MEMORY_TOOL_NAMES } from "../../src/mcp/server.js";

describe("MCP server", () => {
  it("can be constructed with the closed tool registry", () => {
    const server = createMcpServer({ cwd: process.cwd() });
    expect(server).toBeTruthy();
    expect(MEMORY_TOOL_NAMES).toHaveLength(6);
  });
});
