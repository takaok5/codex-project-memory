import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildLanguageCapability } from "../../src/indexer/language.js";
import { resolveLanguageToolCapability } from "../../src/indexer/language-tools.js";
import { defaultProjectConfig } from "../../src/runtime/config-loader.js";
import { ensureMemoryDirectories, getMemoryPaths } from "../../src/runtime/memory-paths.js";
import type { RuntimeContext } from "../../src/shared/types.js";

const originalMode = process.env.PMEM_LANGUAGE_TOOLS;
const originalNpm = process.env.PMEM_LANGUAGE_TOOLS_NPM;
const originalIgnorePath = process.env.PMEM_LANGUAGE_TOOLS_IGNORE_PATH;

afterEach(() => {
  setOrDeleteEnv("PMEM_LANGUAGE_TOOLS", originalMode);
  setOrDeleteEnv("PMEM_LANGUAGE_TOOLS_NPM", originalNpm);
  setOrDeleteEnv("PMEM_LANGUAGE_TOOLS_IGNORE_PATH", originalIgnorePath);
});

describe("language tool manager", () => {
  it("degrades explicitly and logs when user-space install fails", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-tools-fail-"));
    try {
      const ctx = makeContext(root);
      process.env.PMEM_LANGUAGE_TOOLS = "test-install";
      process.env.PMEM_LANGUAGE_TOOLS_IGNORE_PATH = "1";
      process.env.PMEM_LANGUAGE_TOOLS_NPM = "definitely-not-a-real-npm-command";

      const capability = resolveLanguageToolCapability(
        ctx,
        "python",
        buildLanguageCapability("python", {
          parser: "pattern:python",
          tier: "structural",
          symbols: true,
          dependencies: true,
          tests: true,
          routes: true
        })
      );

      expect(capability).toMatchObject({
        language: "python",
        tool: "pyright",
        toolStatus: "failed",
        degradedReason: "language_tool_install_failed"
      });
      const log = readFileSync(path.join(ctx.memoryPaths.logsDirAbs, "language-tools.log"), "utf8");
      expect(log).toContain("language tool install failed");
      expect(log).not.toContain(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses cached tools and writes a pinned lockfile", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-tools-cache-"));
    try {
      const ctx = makeContext(root);
      process.env.PMEM_LANGUAGE_TOOLS = "test-install";
      process.env.PMEM_LANGUAGE_TOOLS_IGNORE_PATH = "1";
      const binDir = path.join(root, ".codex/memory/cache/language-tools/node_modules/.bin");
      mkdirSync(binDir, { recursive: true });
      writeFileSync(path.join(binDir, process.platform === "win32" ? "pyright.cmd" : "pyright"), "");

      const capability = resolveLanguageToolCapability(
        ctx,
        "python",
        buildLanguageCapability("python", {
          parser: "pattern:python",
          tier: "structural",
          symbols: true,
          dependencies: true,
          tests: true,
          routes: true
        })
      );

      expect(capability.toolStatus).toBe("available");
      const lockPath = path.join(root, ".codex/memory/cache/language-tools/pmem-language-tools.lock.json");
      expect(existsSync(lockPath)).toBe(true);
      const lock = JSON.parse(readFileSync(lockPath, "utf8")) as { tools: { pyright: { packageName: string; version: string; binary: string; installedAt: string } } };
      expect(lock.tools.pyright).toMatchObject({ packageName: "pyright", version: "1.1.410", binary: "pyright" });
      expect(lock.tools.pyright.installedAt).toEqual(expect.any(String));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function makeContext(root: string): RuntimeContext {
  const memoryPaths = getMemoryPaths(root);
  ensureMemoryDirectories(memoryPaths);
  return {
    projectRoot: root,
    memoryPaths,
    config: defaultProjectConfig("tool-fixture")
  };
}

function setOrDeleteEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
