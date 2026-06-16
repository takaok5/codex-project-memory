import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdDoctor } from "../../src/cli/commands/doctor.js";
import { cmdHead } from "../../src/cli/commands/head.js";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";

describe("init/doctor/head CLI commands", () => {
  it("reports not initialized before init, then creates memory and reports fresh state", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-cli-"));
    try {
      await expect(cmdHead({ cwd: root })).resolves.toMatchObject({ ok: true, data: { status: "not_initialized" } });
      await expect(cmdDoctor({ cwd: root })).resolves.toMatchObject({ ok: true, data: { overallStatus: "not_initialized" } });

      const init = await cmdInit({ cwd: root });
      expect(init).toMatchObject({
        ok: true,
        data: {
          status: "fresh",
          memoryRoot: ".codex/memory",
          config: ".codex/memory/project-memory.config.json",
          db: ".codex/memory/memory.db",
          schemaVersion: 4
        }
      });
      expect(init.data?.created).toContain(".codex/memory/memory.db");

      await expect(cmdDoctor({ cwd: root })).resolves.toMatchObject({
        ok: true,
        data: {
          overallStatus: "ok",
          capabilities: {
            diagnostics: {
              status: "ok",
              hardGate: false,
              diagnosticsStored: 0,
              degradedLanguages: [],
              failedTools: []
            }
          },
          schema: { userVersion: 4, schemaVersion: "4", foreignKeysEnabled: true, requiredTablesPresent: true, forbiddenTables: [] }
        }
      });
      await expect(cmdHead({ cwd: root })).resolves.toMatchObject({ ok: true, data: { status: "fresh", schemaVersion: "4", memoryDirty: false } });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("is idempotent", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-cli-idem-"));
    try {
      await cmdInit({ cwd: root });
      const second = await cmdInit({ cwd: root });
      expect(second.ok).toBe(true);
      expect(second.data?.created).toEqual([]);
      expect(second.data?.skipped).toContain(".codex/memory/memory.db");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("classifies compiler-assisted diagnostics degradation as a non-blocking capability", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-cli-doctor-diagnostics-"));
    try {
      cpSync(path.resolve("test/fixtures/python-fastapi-basic"), root, { recursive: true });
      await cmdInit({ cwd: root });
      await cmdIndex({ cwd: root });

      await expect(cmdDoctor({ cwd: root })).resolves.toMatchObject({
        ok: true,
        data: {
          overallStatus: "warning",
          capabilities: {
            diagnostics: {
              status: "degraded",
              hardGate: false,
              degradedLanguages: ["python"],
              failedTools: []
            }
          }
        }
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
