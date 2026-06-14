import { describe, expect, it } from "vitest";
import { classifyLanguage, isGeneratedFile, isTestFile } from "../../src/indexer/language.js";

describe("language classification", () => {
  it("classifies v0.1 TS/JS extensions", () => {
    expect(classifyLanguage("src/a.ts")).toBe("typescript");
    expect(classifyLanguage("src/a.tsx")).toBe("typescript");
    expect(classifyLanguage("src/a.js")).toBe("javascript");
    expect(classifyLanguage("src/a.md")).toBeNull();
  });

  it("detects tests and generated files", () => {
    expect(isTestFile("src/access/access.service.spec.ts")).toBe(true);
    expect(isTestFile("src/access/access.service.ts")).toBe(false);
    expect(isGeneratedFile("src/generated/client.ts")).toBe(true);
  });
});
