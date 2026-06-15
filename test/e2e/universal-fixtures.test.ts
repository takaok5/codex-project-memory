import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdDiagnostics } from "../../src/cli/commands/diagnostics.js";
import { cmdDiff } from "../../src/cli/commands/diff.js";
import { cmdDuplicates } from "../../src/cli/commands/duplicates.js";
import { cmdFrame } from "../../src/cli/commands/frame.js";
import { cmdHead } from "../../src/cli/commands/head.js";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { cmdQuery } from "../../src/cli/commands/query.js";
import { cmdRefresh } from "../../src/cli/commands/refresh.js";
import { cmdRender } from "../../src/cli/commands/render.js";
import { cmdScan } from "../../src/cli/commands/scan.js";
import { getMemoryPaths } from "../../src/runtime/memory-paths.js";
import { listFiles } from "../../src/store/file-repository.js";
import { listLanguageCapabilities } from "../../src/store/language-capability-repository.js";
import { listRoutes } from "../../src/store/route-repository.js";
import { openMemoryDb } from "../../src/store/sqlite.js";
import { searchSymbols } from "../../src/store/symbol-repository.js";

interface FixtureExpectation {
  fixture: string;
  languages: string[];
  routes?: string[];
  symbols?: string[];
}

const FIXTURES: FixtureExpectation[] = [
  {
    fixture: "polyglot-basic",
    languages: ["csharp", "css", "go", "java", "python"],
    routes: ["ANY /health", "GET /access/open", "GET /home", "GET /users"],
    symbols: ["AccessController", "AccessService", "HomeController", "Server", "UserController"]
  },
  {
    fixture: "python-fastapi-basic",
    languages: ["python"],
    routes: ["POST /users"],
    symbols: ["UserController", "UserService", "create_user", "test_create"]
  },
  {
    fixture: "go-http-basic",
    languages: ["go"],
    routes: ["ANY /health"],
    symbols: ["HealthService", "TestHealth", "health", "main"]
  },
  {
    fixture: "java-spring-basic",
    languages: ["java"],
    routes: ["GET /users"],
    symbols: ["UserController", "UserService", "UserServiceTest"]
  },
  {
    fixture: "csharp-aspnet-basic",
    languages: ["csharp"],
    routes: ["GET /home"],
    symbols: ["HomeController", "HomeService", "HomeServiceTests"]
  },
  {
    fixture: "rust-cli-basic",
    languages: ["rust"],
    symbols: ["AccessService", "can_open", "main", "test_can_open"]
  },
  {
    fixture: "php-ruby-basic",
    languages: ["php", "ruby"],
    routes: ["GET /ruby-users", "GET /users"],
    symbols: ["UserController", "UsersController", "index", "users"]
  },
  {
    fixture: "html-css-sql-basic",
    languages: ["css", "html", "sql"],
    symbols: [".app-shell", "main", "users"]
  }
];

describe("universal language fixtures", () => {
  for (const expectation of FIXTURES) {
    it(`runs the v0.4 public command sequence for ${expectation.fixture}`, async () => {
      const root = copyFixture(expectation.fixture);
      try {
        const outputs: unknown[] = [];
        outputs.push(await cmdInit({ cwd: root }));
        const scan = await cmdScan({ cwd: root });
        outputs.push(scan);
        expect(scan).toMatchObject({ ok: true, data: { files: { unsupported: 0 } } });

        const index = await cmdIndex({ cwd: root });
        outputs.push(index);
        expect(index.ok).toBe(true);
        expect(index.data?.files.indexed).toBeGreaterThan(0);

        const diagnostics = await cmdDiagnostics({ cwd: root, install: false });
        outputs.push(diagnostics);
        expect(diagnostics.ok).toBe(true);
        expect(diagnostics.data?.languages).toEqual(expectation.languages);
        expect(diagnostics.data?.summary.total).toBeGreaterThan(0);
        expect(diagnostics.data?.summary.degradedLanguages).toEqual(expectation.languages);

        const paths = getMemoryPaths(root);
        let warningsBeforeRefresh = 0;
        const db = openMemoryDb(paths);
        try {
          expect(listFiles(db).map((file) => file.language).filter(Boolean).sort()).toEqual(expectation.languages.flatMap((language) => {
            const filesForLanguage = listFiles(db).filter((file) => file.language === language).length;
            return Array.from({ length: filesForLanguage }, () => language);
          }).sort());
          const capabilities = listLanguageCapabilities(db);
          expect(capabilities.map((capability) => capability.language).sort()).toEqual(expectation.languages);
          expect(capabilities.every((capability) => capability.tier === "deep" || capability.tier === "structural" || capability.tier === "fallback")).toBe(true);
          expect(capabilities.every((capability) => capability.toolStatus === "disabled" || capability.toolStatus === "unsupported")).toBe(true);
          if (expectation.symbols) {
            expect(searchSymbols(db, {}).map((symbol) => symbol.name)).toEqual(expect.arrayContaining(expectation.symbols));
          }
          if (expectation.routes) {
            expect(listRoutes(db).map((route) => `${route.method} ${route.path}`).sort()).toEqual(expectation.routes);
          }
          warningsBeforeRefresh = Number((db.prepare("SELECT COUNT(*) AS count FROM warnings WHERE resolved_at IS NULL").get() as { count: number }).count);
        } finally {
          db.close();
        }

        const render = await cmdRender({ cwd: root, png: false });
        outputs.push(render);
        expect(render.ok).toBe(true);
        expect(render.data?.frames.map((frame) => frame.frame)).toEqual(["current", "overview", "modules", "duplicates", "risks"]);
        expect(existsSync(path.join(root, ".codex/memory/current.svg"))).toBe(true);
        expect(existsSync(path.join(root, ".codex/memory/current.map.json"))).toBe(true);

        const svgBeforeSecondRender = readFileSync(path.join(root, ".codex/memory/current.svg"), "utf8");
        const secondRender = await cmdRender({ cwd: root, png: false });
        outputs.push(secondRender);
        expect(secondRender.data?.sourceHash).toBe(render.data?.sourceHash);
        expect(readFileSync(path.join(root, ".codex/memory/current.svg"), "utf8")).toBe(svgBeforeSecondRender);

        outputs.push(await cmdHead({ cwd: root }));
        outputs.push(await cmdQuery({ cwd: root, intent: "find project service routes and tests", visual: true }));
        outputs.push(await cmdDuplicates({ cwd: root, kind: "service", proposedName: "UniversalService", intent: "check duplicate service before creating UniversalService" }));
        outputs.push(await cmdFrame({ cwd: root, frame: "current" }));
        const refresh = await cmdRefresh({ cwd: root, render: false, reason: "universal-fixture-test" });
        outputs.push(refresh);
        expect(refresh).toMatchObject({ ok: true, data: { changedOnly: true, index: { filesDeleted: 0 } } });
        outputs.push(await cmdDiff({ cwd: root }));

        const capabilitiesJson = readJson(path.join(root, ".codex/memory/generated/language-capabilities.json")) as Array<{ language: string }>;
        const diagnosticsJson = readJson(path.join(root, ".codex/memory/generated/diagnostics.json")) as Array<{ language: string; filePath: string; severity: string }>;
        const currentMap = readJson(path.join(root, ".codex/memory/current.map.json")) as { languageCapabilities: Array<{ language: string }> };
        const latestSnapshot = readJson(path.join(root, ".codex/memory/snapshots/latest.snapshot.json")) as {
          languageCapabilities: Array<{ language: string }>;
          diagnostics: Array<{ language: string; filePath: string; severity: string }>;
        };
        expect(capabilitiesJson.map((item) => item.language).sort()).toEqual(expectation.languages);
        expect(diagnosticsJson.map((item) => item.language).sort()).toEqual(expect.arrayContaining(expectation.languages));
        expect(currentMap.languageCapabilities.map((item) => item.language).sort()).toEqual(expectation.languages);
        expect(latestSnapshot.languageCapabilities.map((item) => item.language).sort()).toEqual(expectation.languages);
        expect(latestSnapshot.diagnostics.map((item) => item.language).sort()).toEqual(expect.arrayContaining(expectation.languages));
        outputs.push(capabilitiesJson, diagnosticsJson, currentMap, latestSnapshot);

        const dbAfterRefresh = openMemoryDb(paths);
        try {
          const warningsAfterRefresh = Number((dbAfterRefresh.prepare("SELECT COUNT(*) AS count FROM warnings WHERE resolved_at IS NULL").get() as { count: number }).count);
          expect(warningsAfterRefresh).toBe(warningsBeforeRefresh);
        } finally {
          dbAfterRefresh.close();
        }

        assertPublicOutputSafe(root, outputs);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }

  it("hard-deletes stale cross-language records on changed-only index", async () => {
    const root = copyFixture("python-fastapi-basic");
    try {
      await cmdInit({ cwd: root });
      await cmdIndex({ cwd: root });
      rmSync(path.join(root, "api/service.py"));
      await expect(cmdIndex({ cwd: root, changedOnly: true })).resolves.toMatchObject({ ok: true, data: { files: { deleted: 1 } } });
      const db = openMemoryDb(getMemoryPaths(root));
      try {
        expect(listFiles(db).map((file) => file.path)).not.toContain("api/service.py");
        expect(searchSymbols(db, {}).map((symbol) => symbol.name)).not.toContain("UserService");
      } finally {
        db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function copyFixture(name: string): string {
  const root = mkdtempSync(path.join(tmpdir(), `pmem-${name}-`));
  cpSync(path.resolve("test/fixtures", name), root, { recursive: true });
  return root;
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8")) as unknown;
}

function assertPublicOutputSafe(root: string, outputs: unknown[]): void {
  const text = JSON.stringify(outputs);
  expect(text).not.toContain(root);
  expect(text).not.toMatch(/[A-Za-z]:[\\/]/);
  expect(text).not.toContain("\\");
  expect(text).not.toContain("../");
  expect(text).not.toContain("class UserService {\n");
}
