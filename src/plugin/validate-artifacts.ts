import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { safeJsonParse } from "../shared/json.js";
import type { PluginArtifactValidationResult } from "../shared/types.js";
import { validatePluginManifest } from "./manifest.js";
import { validateMcpConfig } from "./mcp-config.js";

const REQUIRED_FILES = [
  ".codex-plugin/plugin.json",
  ".mcp.json",
  "skills/repo-memory/SKILL.md",
  "skills/repo-memory/agents/openai.yaml",
  "hooks/hooks.json",
  "assets/icon.png",
  "assets/logo.png"
];

export function validatePluginArtifacts(root: string): PluginArtifactValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const relativePath of REQUIRED_FILES) {
    if (!existsSync(path.join(root, relativePath))) {
      missing.push(relativePath);
    }
  }

  if (missing.length > 0) {
    return { ok: false, missing, warnings };
  }

  validateJsonFile(root, ".codex-plugin/plugin.json", warnings, validatePluginManifest);
  validateJsonFile(root, ".mcp.json", warnings, validateMcpConfig);
  validateJsonFile(root, "hooks/hooks.json", warnings, validateHooksConfig);
  validateSkill(root, warnings);
  validatePng(path.join(root, "assets/icon.png"), "assets/icon.png", warnings);
  validatePng(path.join(root, "assets/logo.png"), "assets/logo.png", warnings);

  return { ok: missing.length === 0 && warnings.length === 0, missing, warnings };
}

function validateJsonFile(root: string, relativePath: string, warnings: string[], validator: (value: unknown) => unknown): void {
  const fullPath = path.join(root, relativePath);
  const parsed = safeJsonParse<unknown>(readFileSync(fullPath, "utf8"));
  if (!parsed.ok) {
    warnings.push(`${relativePath}: invalid JSON`);
    return;
  }

  try {
    validator(parsed.value);
    if (containsUnsafePath(parsed.value)) {
      warnings.push(`${relativePath}: contains unsafe path`);
    }
  } catch (error) {
    warnings.push(`${relativePath}: ${error instanceof Error ? error.message : "invalid"}`);
  }
}

function validateHooksConfig(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("hooks config must be an object");
  }
  const hooks = (value as { hooks?: unknown }).hooks;
  if (!hooks || typeof hooks !== "object" || Array.isArray(hooks)) {
    throw new Error("hooks object is required");
  }

  for (const hookName of ["UserPromptSubmit", "PostToolUse", "Stop", "SubagentStop"]) {
    const hookValue = (hooks as Record<string, unknown>)[hookName];
    const serialized = JSON.stringify(hookValue);
    if (!Array.isArray(hookValue) || !serialized.includes("node ${PLUGIN_ROOT}/dist/hooks/") || !serialized.includes(".js")) {
      throw new Error(`missing or invalid ${hookName}`);
    }
  }
}

function validateSkill(root: string, warnings: string[]): void {
  const text = readFileSync(path.join(root, "skills/repo-memory/SKILL.md"), "utf8");
  for (const required of ["memory.head", "memory.query", "memory.duplicates", "Do not read `.codex/memory/memory.db` directly", "trusted by the user"]) {
    if (!text.includes(required)) {
      warnings.push(`skills/repo-memory/SKILL.md: missing ${required}`);
    }
  }
}

function validatePng(fullPath: string, relativePath: string, warnings: string[]): void {
  const bytes = readFileSync(fullPath);
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (!isPng) {
    warnings.push(`${relativePath}: invalid PNG`);
  }
}

function containsUnsafePath(value: unknown): boolean {
  if (typeof value === "string") {
    return path.isAbsolute(value) || value.includes("\\") || value.split("/").includes("..");
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsUnsafePath(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsUnsafePath(item));
  }

  return false;
}
