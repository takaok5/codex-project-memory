import { describe, expect, it } from "vitest";
import { PmemError, recoverableDefault, toErrorPayload } from "../../src/shared/errors.js";

describe("PmemError", () => {
  it("preserves code, recoverability and details", () => {
    const error = new PmemError("NOT_INITIALIZED", "Project memory is not initialized. Run pmem init.", {
      details: { nextCommand: "pmem init --json" }
    });

    expect(error.code).toBe("NOT_INITIALIZED");
    expect(error.recoverable).toBe(true);
    expect(error.details).toEqual({ nextCommand: "pmem init --json" });
  });

  it("uses documented recoverability defaults", () => {
    expect(recoverableDefault("VALIDATION_ERROR")).toBe(true);
    expect(recoverableDefault("DB_ERROR")).toBe(false);
  });
});

describe("toErrorPayload", () => {
  it("maps PmemError without wrapping it in a CLI result", () => {
    const payload = toErrorPayload(
      new PmemError("FRAME_NOT_FOUND", "Requested memory frame was not found.", {
        details: { nextCommand: "pmem render --json" }
      })
    );

    expect(payload).toEqual({
      code: "FRAME_NOT_FOUND",
      message: "Requested memory frame was not found.",
      recoverable: true,
      details: { nextCommand: "pmem render --json" }
    });
  });

  it("maps unknown errors to INTERNAL_ERROR and redacts absolute paths", () => {
    const payload = toErrorPayload(new Error("Failed at C:\\Users\\fat\\secret\\file.ts"));

    expect(payload.code).toBe("INTERNAL_ERROR");
    expect(payload.recoverable).toBe(false);
    expect(payload.message).not.toContain("C:\\Users");
  });
});
