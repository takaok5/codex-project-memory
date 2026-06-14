import { describe, expect, it } from "vitest";
import { getMemoryToolSchemas, MEMORY_TOOL_NAMES } from "../../src/mcp/schemas.js";

describe("MCP schemas", () => {
  it("exposes the six granular tools plus memory.agent", () => {
    expect(MEMORY_TOOL_NAMES).toEqual(["memory.head", "memory.query", "memory.duplicates", "memory.frame", "memory.refresh", "memory.diff", "memory.agent"]);
    expect(Object.keys(getMemoryToolSchemas()).sort()).toEqual([...MEMORY_TOOL_NAMES].sort());
  });
});
