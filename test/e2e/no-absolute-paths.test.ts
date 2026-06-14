import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdDiff } from "../../src/cli/commands/diff.js";
import { cmdDuplicates } from "../../src/cli/commands/duplicates.js";
import { cmdHead } from "../../src/cli/commands/head.js";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { cmdQuery } from "../../src/cli/commands/query.js";
import { cmdRender } from "../../src/cli/commands/render.js";
import { runPostToolUseHook } from "../../src/hooks/post-tool-use.js";
import { handleMemoryHead } from "../../src/mcp/tools/head.js";
import { getMemoryPaths } from "../../src/runtime/memory-paths.js";
import { openMemoryDb } from "../../src/store/sqlite.js";

describe("public output path audit", () => {
  it("does not expose absolute paths or Windows separators", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-e2e-paths-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      const outputs: unknown[] = [];
      outputs.push(await cmdInit({ cwd: root }));
      outputs.push(await cmdIndex({ cwd: root }));
      outputs.push(await cmdRender({ cwd: root, png: false }));
      outputs.push(await cmdHead({ cwd: root }));
      outputs.push(await cmdQuery({ cwd: root, intent: "access subscription suspended", visual: true }));
      outputs.push(await cmdDuplicates({ cwd: root, kind: "service", moduleId: "access", proposedName: "AccessValidationService", intent: "AccessValidationService / verifica diritto accesso" }));
      outputs.push(await cmdDiff({ cwd: root }));
      outputs.push(await handleMemoryHead({}, { cwd: root }));
      outputs.push(await runPostToolUseHook({ changedFiles: ["src/access/access.service.ts"] }, root));

      const paths = getMemoryPaths(root);
      for (const file of listJsonFiles(paths.generatedDirAbs)) outputs.push(JSON.parse(readFileSync(file, "utf8")));
      for (const file of [paths.currentMapAbs, ...listJsonFiles(paths.framesDirAbs).filter((file) => file.endsWith(".map.json")), ...listJsonFiles(paths.snapshotsDirAbs)]) {
        outputs.push(JSON.parse(readFileSync(file, "utf8")));
      }
      const db = openMemoryDb(paths);
      try {
        outputs.push(db.prepare("SELECT owns_json, must_not_json, dependencies_json FROM modules").all());
        const logs = db.prepare("SELECT output_json FROM retrieval_logs").all() as Array<{ output_json: string }>;
        outputs.push(logs.map((log) => JSON.parse(log.output_json)));
      } finally {
        db.close();
      }
      const text = JSON.stringify(outputs);
      expect(text).not.toContain(root);
      expect(text).not.toMatch(/[A-Za-z]:[\\/]/);
      expect(text).not.toContain("\\");
      expect(text).not.toContain("../");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function listJsonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJsonFiles(abs);
    return entry.name.endsWith(".json") ? [abs] : [];
  });
}
