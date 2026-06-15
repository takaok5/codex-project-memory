import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { cmdRender } from "../../src/cli/commands/render.js";
import { getMemoryPaths } from "../../src/runtime/memory-paths.js";
import { listFiles } from "../../src/store/file-repository.js";
import { listLanguageCapabilities } from "../../src/store/language-capability-repository.js";
import { listRoutes } from "../../src/store/route-repository.js";
import { searchSymbols } from "../../src/store/symbol-repository.js";
import { openMemoryDb } from "../../src/store/sqlite.js";

describe("polyglot project memory", () => {
  it("indexes structural memory and capability flags across non-TS languages", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-polyglot-"));
    try {
      writeFixture(root, "api/main.py", `
from .services import AccessService

class AccessController:
    pass

@router.get("/access/open")
def open_access():
    return {"ok": True}
`);
      writeFixture(root, "api/services.py", `
class AccessService:
    def can_open(self):
        return True
`);
      writeFixture(root, "cmd/server/main.go", `
package main

import "./access"

type Server struct {}

func main() {
    http.HandleFunc("/health", health)
}

func health(w http.ResponseWriter, r *http.Request) {}
`);
      writeFixture(root, "src/main/java/demo/UserController.java", `
package demo;

import demo.UserService;

public class UserController {
  @GetMapping("/users")
  public String users() { return "ok"; }
}
`);
      writeFixture(root, "Controllers/HomeController.cs", `
using Demo.Services;

public class HomeController {
  [HttpGet("home")]
  public string Home() { return "ok"; }
}
`);
      writeFixture(root, "public/app.css", `
.app-shell {
  color: #111;
}
`);

      await cmdInit({ cwd: root });
      const indexed = await cmdIndex({ cwd: root });
      expect(indexed.ok).toBe(true);

      const paths = getMemoryPaths(root);
      const db = openMemoryDb(paths);
      try {
        const files = listFiles(db);
        expect(files.map((file) => `${file.language}:${file.path}`)).toEqual([
          "csharp:Controllers/HomeController.cs",
          "python:api/main.py",
          "python:api/services.py",
          "go:cmd/server/main.go",
          "css:public/app.css",
          "java:src/main/java/demo/UserController.java"
        ]);
        expect(searchSymbols(db, {}).map((symbol) => `${symbol.kind}:${symbol.fqName}`)).toEqual(expect.arrayContaining([
          "controller:AccessController",
          "service:AccessService",
          "controller:HomeController",
          "class:Server",
          "controller:UserController",
          "feature:.app-shell"
        ]));
        expect(listRoutes(db).map((route) => `${route.method} ${route.path}`).sort()).toEqual(["ANY /health", "GET /access/open", "GET /home", "GET /users"]);
        const capabilities = listLanguageCapabilities(db);
        expect(capabilities.map((capability) => `${capability.language}:${capability.tier}`).sort()).toEqual([
          "csharp:structural",
          "css:structural",
          "go:structural",
          "java:structural",
          "python:structural"
        ]);
        expect(capabilities.every((capability) => capability.toolStatus === "disabled" || capability.toolStatus === "unsupported")).toBe(true);
      } finally {
        db.close();
      }

      const rendered = await cmdRender({ cwd: root, png: false });
      expect(rendered.ok).toBe(true);
      const languageCapabilities = JSON.parse(readFileSync(path.join(root, ".codex/memory/generated/language-capabilities.json"), "utf8")) as Array<{ language: string }>;
      expect(languageCapabilities.map((item) => item.language).sort()).toEqual(["csharp", "css", "go", "java", "python"]);
      const publicOutput = JSON.stringify({ rendered, languageCapabilities });
      expect(publicOutput).not.toContain(root);
      expect(publicOutput).not.toContain("\\");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function writeFixture(root: string, relativePath: string, content: string): void {
  const abs = path.join(root, relativePath);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content.trimStart());
}
