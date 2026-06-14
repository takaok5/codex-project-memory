import { describe, expect, it } from "vitest";
import { dispatchAgent } from "../../src/agents/dispatcher.js";

describe("agent dispatcher", () => {
  it("rejects unknown agents", async () => {
    await expect(dispatchAgent({} as never, "missing" as never, {})).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
