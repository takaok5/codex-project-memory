import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdDiff } from "../../src/cli/commands/diff.js";
import { cmdDiagnostics } from "../../src/cli/commands/diagnostics.js";
import { cmdDuplicates } from "../../src/cli/commands/duplicates.js";
import { cmdAgentRun } from "../../src/cli/commands/agent.js";
import { cmdHead } from "../../src/cli/commands/head.js";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { cmdQuery } from "../../src/cli/commands/query.js";
import { cmdRefresh } from "../../src/cli/commands/refresh.js";
import { cmdRender } from "../../src/cli/commands/render.js";
import { handleMemoryHead } from "../../src/mcp/tools/head.js";
import { handleMemoryAgent } from "../../src/mcp/tools/agent.js";
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
      outputs.push(await cmdDiagnostics({ cwd: root, install: false }));
      outputs.push(await cmdRender({ cwd: root, png: false }));
      outputs.push(await cmdHead({ cwd: root }));
      outputs.push(await cmdQuery({ cwd: root, intent: "access subscription suspended", visual: true }));
      outputs.push(await cmdDuplicates({ cwd: root, kind: "service", moduleId: "access", proposedName: "AccessValidationService", intent: "AccessValidationService / verifica diritto accesso" }));
      outputs.push(await cmdDiff({ cwd: root }));
      outputs.push(await handleMemoryHead({}, { cwd: root }));
      outputs.push(await cmdRefresh({ cwd: root, render: false, reason: "path-audit" }));
      outputs.push(await cmdAgentRun({ cwd: root, intent: "access subscription suspended", refresh: false }));
      outputs.push(await handleMemoryAgent({ intent: "access subscription suspended", allowRefresh: false }, { cwd: root }));

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
        outputs.push(db.prepare("SELECT command, output_summary FROM runtime_evidence_runs").all());
        outputs.push(db.prepare("SELECT file_path, message FROM runtime_evidence_items").all());
        const evidenceRecords = db
          .prepare("SELECT source, summary, file_path, metadata_json FROM evidence_records")
          .all() as Array<{ source: string; summary: string; file_path: string | null; metadata_json: string }>;
        outputs.push(
          evidenceRecords.map((record) => ({
            source: record.source,
            summary: record.summary,
            file_path: record.file_path,
            metadata: JSON.parse(record.metadata_json)
          }))
        );
        outputs.push(db.prepare("SELECT title, summary, rationale, file_path FROM architecture_decisions").all());
        outputs.push(db.prepare("SELECT evidence_key, intent, source FROM evidence_feedback").all());
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
