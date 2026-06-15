import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseGenericDiagnostics, parseGoDiagnostics, parsePyrightDiagnostics, parseRustDiagnostics, parseTypeScriptDiagnostics } from "../../src/indexer/diagnostic-runner.js";

describe("diagnostic parsers", () => {
  const root = path.resolve("fixture-root");

  it("parses TypeScript compiler diagnostics", () => {
    const output = `${path.join(root, "src/app.ts")}(3,12): error TS2322: Type 'number' is not assignable to type 'string'.`;
    expect(parseTypeScriptDiagnostics(output, root)).toEqual([
      expect.objectContaining({
        language: "typescript",
        filePath: "src/app.ts",
        severity: "error",
        code: "TS2322",
        startLine: 3,
        tool: "tsc"
      })
    ]);
  });

  it("parses Pyright JSON diagnostics", () => {
    const output = JSON.stringify({
      generalDiagnostics: [
        {
          file: path.join(root, "api/main.py"),
          severity: "warning",
          rule: "reportUnknownVariableType",
          message: "Type is unknown",
          range: { start: { line: 4 }, end: { line: 4 } }
        }
      ]
    });
    expect(parsePyrightDiagnostics(output, root)).toEqual([
      expect.objectContaining({
        language: "python",
        filePath: "api/main.py",
        severity: "warning",
        code: "reportUnknownVariableType",
        startLine: 5,
        tool: "pyright"
      })
    ]);
  });

  it("parses Go diagnostics", () => {
    expect(parseGoDiagnostics("main.go:7:2: undefined: missing", root)).toEqual([
      expect.objectContaining({
        language: "go",
        filePath: "main.go",
        severity: "error",
        message: "undefined: missing",
        startLine: 7,
        tool: "go"
      })
    ]);
  });

  it("parses Rust compiler-message JSON", () => {
    const output = JSON.stringify({
      reason: "compiler-message",
      message: {
        level: "warning",
        message: "unused variable",
        code: { code: "unused_variables" },
        spans: [{ file_name: "src/lib.rs", line_start: 9, line_end: 9, is_primary: true }]
      }
    });
    expect(parseRustDiagnostics(output, root)).toEqual([
      expect.objectContaining({
        language: "rust",
        filePath: "src/lib.rs",
        severity: "warning",
        code: "unused_variables",
        startLine: 9,
        tool: "cargo"
      })
    ]);
  });

  it("parses generic compiler diagnostics", () => {
    expect(parseGenericDiagnostics("src/User.php:11: warning missing return type", root, "php", "intelephense")).toEqual([
      expect.objectContaining({
        language: "php",
        filePath: "src/User.php",
        severity: "warning",
        message: "missing return type",
        startLine: 11,
        tool: "intelephense"
      })
    ]);
  });
});
