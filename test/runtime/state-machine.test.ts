import { describe, expect, it } from "vitest";
import { transitionMemoryState } from "../../src/runtime/state-machine.js";

describe("state machine", () => {
  it("applies documented transitions", () => {
    expect(transitionMemoryState("not_initialized", "init_completed")).toBe("fresh");
    expect(transitionMemoryState("fresh", "mark_dirty")).toBe("dirty");
    expect(transitionMemoryState("dirty", "index_completed")).toBe("fresh");
  });

  it("rejects undocumented transitions", () => {
    expect(() => transitionMemoryState("not_initialized", "render_completed")).toThrow();
  });
});
