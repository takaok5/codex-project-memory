import { describe, expect, it } from "vitest";
import { escapeSvgText, truncateLabel } from "../../src/renderer/svg-renderer.js";

describe("svg renderer helpers", () => {
  it("escapes text and truncates labels deterministically", () => {
    expect(escapeSvgText("<Access & Auth>")).toBe("&lt;Access &amp; Auth&gt;");
    expect(truncateLabel("abcdefghijklmnopqrstuvwxyz", 8)).toBe("abcdefg…");
  });
});
