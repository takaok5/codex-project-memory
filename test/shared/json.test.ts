import { describe, expect, it } from "vitest";
import { PmemError } from "../../src/shared/errors.js";
import { safeJsonParse, stableStringify, writeJson } from "../../src/shared/json.js";

describe("safeJsonParse", () => {
  it("returns a discriminated success result", () => {
    expect(safeJsonParse<{ ok: boolean }>(`{"ok":true}`)).toEqual({ ok: true, value: { ok: true } });
  });

  it("returns a discriminated failure result", () => {
    const parsed = safeJsonParse("{");
    expect(parsed.ok).toBe(false);
  });
});

describe("stableStringify", () => {
  it("sorts object keys recursively", () => {
    expect(stableStringify({ z: 1, a: { b: 2, a: 1 } })).toBe(`{"a":{"a":1,"b":2},"z":1}`);
  });

  it("throws a PmemError for circular values", () => {
    const value: Record<string, unknown> = {};
    value.self = value;

    expect(() => writeJson(value)).toThrow(PmemError);
  });
});
