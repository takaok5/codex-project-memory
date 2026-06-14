import { describe, expect, it } from "vitest";
import path from "node:path";
import { scanProjectFiles } from "../../src/indexer/scan.js";
import { indexFileAst } from "../../src/indexer/ast-indexer.js";
import { defaultProjectConfig } from "../../src/runtime/config-loader.js";

describe("AST indexer", () => {
  it("extracts controller symbols, imports and literal Nest routes", async () => {
    const root = path.resolve("test/fixtures/nest-basic");
    const file = (await scanProjectFiles(root, defaultProjectConfig("nest-basic-fixture"))).find((item) => item.path === "src/access/access.controller.ts");
    expect(file).toBeDefined();
    const result = indexFileAst(file!.absPath, file!, { fileId: 1, moduleId: "access" });
    expect(result.symbols.map((symbol) => [symbol.fqName, symbol.kind])).toContainEqual(["AccessController", "controller"]);
    expect(result.symbols.map((symbol) => [symbol.fqName, symbol.kind])).toContainEqual(["AccessController.open", "method"]);
    expect(result.imports.some((item) => item.sourceModule === "@nestjs/common")).toBe(true);
    expect(result.routes).toMatchObject([{ method: "POST", path: "/access/open", moduleId: "access" }]);
  });
});
