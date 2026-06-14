import { describe, expect, it, vi } from "vitest";
import { runCli } from "../../src/cli/pmem.js";
import { VERSION } from "../../src/shared/version.js";

describe("pmem CLI bootstrap", () => {
  it("prints help and exits 0", async () => {
    let output = "";
    const out = vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      output += chunk.toString();
      return true;
    });

    const code = await runCli(["--help"]);

    out.mockRestore();
    expect(code).toBe(0);
    expect(output).toContain("Usage: pmem");
    expect(output).toContain("Codex Project Memory CLI");
  });

  it("prints version and exits 0", async () => {
    let output = "";
    const out = vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      output += chunk.toString();
      return true;
    });

    const code = await runCli(["--version"]);

    out.mockRestore();
    expect(code).toBe(0);
    expect(output.trim()).toBe(VERSION);
  });
});
