import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getMemoryPaths } from "../../src/runtime/memory-paths.js";
import { nowIso } from "../../src/shared/time.js";
import { addDiagnostic, listDiagnostics } from "../../src/store/diagnostic-repository.js";
import { removeFileRecordCascade, upsertFileRecord } from "../../src/store/file-repository.js";
import { ensureSchema, openMemoryDb } from "../../src/store/sqlite.js";

describe("diagnostic repository", () => {
  it("dedupes, sanitizes and cascades diagnostics with files", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-diagnostics-"));
    try {
      const db = openMemoryDb(getMemoryPaths(root));
      try {
        ensureSchema(db);
        const fileId = upsertFileRecord(db, {
          path: "src/app.ts",
          language: "typescript",
          moduleId: null,
          hash: "sha256:test",
          sizeBytes: 12,
          lineCount: 1,
          isTest: false,
          isGenerated: false,
          lastIndexedAt: nowIso()
        });

        const input = {
          language: "typescript",
          filePath: "src/app.ts",
          severity: "error" as const,
          code: "TS2322",
          message: "Failure in C:\\Users\\Example\\repo\\src\\app.ts",
          startLine: 2,
          endLine: 1,
          source: "compiler" as const,
          tool: "C:\\tools\\tsc.cmd",
          confidence: 2
        };
        expect(addDiagnostic(db, input)).toBeGreaterThan(0);
        expect(addDiagnostic(db, input)).toBeGreaterThan(0);

        const diagnostics = listDiagnostics(db);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]).toMatchObject({
          fileId,
          filePath: "src/app.ts",
          message: "Failure in <path>",
          tool: "tsc.cmd",
          confidence: 1,
          startLine: 2,
          endLine: 2
        });

        removeFileRecordCascade(db, "src/app.ts");
        expect(listDiagnostics(db)).toHaveLength(0);
      } finally {
        db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects unsafe diagnostic paths", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-diagnostics-paths-"));
    try {
      const db = openMemoryDb(getMemoryPaths(root));
      try {
        ensureSchema(db);
        expect(() =>
          addDiagnostic(db, {
            language: "typescript",
            filePath: "../app.ts",
            severity: "error",
            code: null,
            message: "unsafe",
            startLine: null,
            endLine: null,
            source: "compiler",
            tool: "tsc",
            confidence: 1
          })
        ).toThrow();
      } finally {
        db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
