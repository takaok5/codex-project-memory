import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runUserPromptSubmitHook } from "../../src/hooks/user-prompt-submit.js";

describe("UserPromptSubmit hook", () => {
  it("accepts missing memory without scanning", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-hook-ups-"));
    try {
      await expect(runUserPromptSubmitHook(root)).resolves.toMatchObject({ ok: true, action: "additional_context" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
