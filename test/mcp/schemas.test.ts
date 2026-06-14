import { describe, expect, it } from "vitest";
import { getMemoryToolSchemas, MEMORY_TOOL_NAMES } from "../../src/mcp/schemas.js";

describe("MCP schemas", () => {
  it("exposes exactly the six v0.1 tools", () => {
    expect(MEMORY_TOOL_NAMES).toEqual(["memory.head", "memory.query", "memory.duplicates", "memory.frame", "memory.refresh", "memory.diff"]);
    expect(Object.keys(getMemoryToolSchemas()).sort()).toEqual([...MEMORY_TOOL_NAMES].sort());
  });
});
