import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ensureAssetPlaceholders } from "../../src/plugin/assets.js";
import { buildPluginManifest, validatePluginManifest } from "../../src/plugin/manifest.js";
import { buildMcpConfig, validateMcpConfig } from "../../src/plugin/mcp-config.js";
import { buildRepoMemorySkillDoc } from "../../src/plugin/skill.js";
import { validatePluginArtifacts } from "../../src/plugin/validate-artifacts.js";
import { safeJsonParse } from "../../src/shared/json.js";

const root = process.cwd();

describe("plugin static artifacts", () => {
  it("validates checked-in plugin packaging artifacts", () => {
    const manifest = readJson(".codex-plugin/plugin.json");
    const mcpConfig = readJson(".mcp.json");

    expect(validatePluginManifest(manifest)).toEqual(buildPluginManifest({
      packageName: "codex-project-memory",
      version: "0.2.0",
      mcpConfigPath: "./.mcp.json",
      skillsPath: "./skills/",
      assets: { iconPng: "assets/icon.png", logoPng: "assets/logo.png" }
    }));
    expect(validateMcpConfig(mcpConfig)).toEqual(buildMcpConfig({
      serverName: "project-memory",
      command: "node",
      args: ["dist/mcp/server.js"]
    }));
    expect(validatePluginArtifacts(root)).toEqual({ ok: true, missing: [], warnings: [] });
  });

  it("renders the repo-memory skill without project memory facts", () => {
    const skill = buildRepoMemorySkillDoc({
      pluginName: "codex-project-memory",
      cliCommand: "pmem",
      mcpServerName: "project-memory"
    });

    expect(skill).toContain("memory.head");
    expect(skill).toContain("memory.query");
    expect(skill).toContain("memory.duplicates");
    expect(skill).toContain("Supported lifecycle");
    expect(skill).toContain("implicit skill policy");
    expect(skill).toContain("Do not read `.codex/memory/memory.db` directly");
    expect(skill).not.toContain("AccessService");
  });

  it("creates placeholder PNG assets without requiring remote files", () => {
    const temp = mkdtempSync(path.join(tmpdir(), "pmem-assets-"));
    try {
      const icon = path.join(temp, "icon.png");
      const logo = path.join(temp, "logo.png");

      ensureAssetPlaceholders({ iconPng: icon, logoPng: logo });

      expect([...readFileSync(icon).subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
      expect([...readFileSync(logo).subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});

function readJson(relativePath: string): unknown {
  const parsed = safeJsonParse<unknown>(readFileSync(path.join(root, relativePath), "utf8"));
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  return parsed.value;
}
