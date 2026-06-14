import { describe, expect, it } from "vitest";
import { normalizeArtifactNameForDuplicate, tokenizeForDuplicate, tokenizeForSearch } from "../../src/agents/tokenize.js";

describe("agent tokenization", () => {
  it("splits camel case and removes duplicate suffixes only for duplicate checks", () => {
    expect(tokenizeForSearch("AccessValidationService")).toEqual(["access", "service", "validation"]);
    expect(tokenizeForDuplicate("AccessValidationService")).toEqual(["access", "validation"]);
    expect(normalizeArtifactNameForDuplicate("AccessValidationService")).toBe("access validation");
  });
});
