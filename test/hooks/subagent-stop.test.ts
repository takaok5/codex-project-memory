import { describe, expect, it } from "vitest";
import { runSubagentStopHook } from "../../src/hooks/subagent-stop.js";

describe("SubagentStop hook", () => {
  it("returns JSON-compatible logged output", async () => {
    await expect(runSubagentStopHook({})).resolves.toEqual({ ok: true, action: "logged", warnings: [] });
  });
});
