import { describe, expect, it } from "vitest";
import { classifyLanguage, isGeneratedFile, isLanguageEnabled, isTestFile, listKnownLanguages } from "../../src/indexer/language.js";
import { defaultProjectConfig } from "../../src/runtime/config-loader.js";

describe("language classification", () => {
  it("classifies v0.1 TS/JS extensions", () => {
    expect(classifyLanguage("src/a.ts")).toBe("typescript");
    expect(classifyLanguage("src/a.tsx")).toBe("typescript");
    expect(classifyLanguage("src/a.js")).toBe("javascript");
    expect(classifyLanguage("src/a.md")).toBeNull();
  });

  it("classifies top language set for v0.3 universal memory", () => {
    expect(classifyLanguage("app/main.py")).toBe("python");
    expect(classifyLanguage("cmd/api/main.go")).toBe("go");
    expect(classifyLanguage("src/App.java")).toBe("java");
    expect(classifyLanguage("Controllers/HomeController.cs")).toBe("csharp");
    expect(classifyLanguage("web/index.php")).toBe("php");
    expect(classifyLanguage("app/models/user.rb")).toBe("ruby");
    expect(classifyLanguage("src/lib.rs")).toBe("rust");
    expect(classifyLanguage("src/main.c")).toBe("c");
    expect(classifyLanguage("src/main.cpp")).toBe("cpp");
    expect(classifyLanguage("src/App.kt")).toBe("kotlin");
    expect(classifyLanguage("App.swift")).toBe("swift");
    expect(classifyLanguage("scripts/deploy.sh")).toBe("shell");
    expect(classifyLanguage("lib/main.dart")).toBe("dart");
    expect(classifyLanguage("src/Main.scala")).toBe("scala");
    expect(classifyLanguage("analysis/model.R")).toBe("r");
    expect(classifyLanguage("init.lua")).toBe("lua");
    expect(classifyLanguage("lib/app.ex")).toBe("elixir");
    expect(classifyLanguage("src/core.clj")).toBe("clojure");
    expect(classifyLanguage("db/schema.sql")).toBe("sql");
    expect(classifyLanguage("public/index.html")).toBe("html");
    expect(classifyLanguage("public/app.css")).toBe("css");
  });

  it("supports wildcard and explicit language filters", () => {
    const config = defaultProjectConfig("demo");
    expect(isLanguageEnabled("python", config)).toBe(true);
    expect(isLanguageEnabled("typescript", { ...config, scan: { ...config.scan, languages: ["typescript"] } })).toBe(true);
    expect(isLanguageEnabled("python", { ...config, scan: { ...config.scan, languages: ["typescript"] } })).toBe(false);
    expect(listKnownLanguages().map((item) => item.id)).toContain("python");
  });

  it("detects tests and generated files", () => {
    expect(isTestFile("src/access/access.service.spec.ts")).toBe(true);
    expect(isTestFile("src/access/access.service.ts")).toBe(false);
    expect(isGeneratedFile("src/generated/client.ts")).toBe(true);
  });
});
