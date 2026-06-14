import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultProjectConfig, loadProjectConfig, validateProjectConfig, writeDefaultProjectConfig } from "../../src/runtime/config-loader.js";
import { getMemoryPaths } from "../../src/runtime/memory-paths.js";

describe("config loader", () => {
  it("uses documented defaults", () => {
    expect(defaultProjectConfig("demo")).toMatchObject({
      schemaVersion: 1,
      projectName: "demo",
      scan: { include: ["src/**/*", "apps/**/*", "packages/**/*"], maxFileBytes: 524288 },
      render: { png: true, maxModules: 40, maxWarnings: 20 },
      agents: { maxFiles: 8, maxSymbols: 12, maxWarnings: 8 }
    });
  });

  it("writes, loads and validates config with .codex/memory excluded", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-config-"));
    try {
      writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture-package" }));
      const paths = getMemoryPaths(root);
      mkdirSync(paths.memoryRootAbs, { recursive: true });
      writeDefaultProjectConfig(paths);
      const config = loadProjectConfig(paths);
      expect(config.projectName).toBe("fixture-package");
      expect(config.scan.exclude).toContain(".codex/memory/**");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects unknown config keys", () => {
    expect(() => validateProjectConfig({ ...defaultProjectConfig("demo"), unknown: true })).toThrow();
  });

  it("ignores legacy hooks config from earlier plugin drafts", () => {
    expect(validateProjectConfig({
      ...defaultProjectConfig("demo"),
      hooks: { enabled: true, autoRefreshOnStop: true, maxChangedFilesForStopRefresh: 20 }
    })).not.toHaveProperty("hooks");
  });
});
