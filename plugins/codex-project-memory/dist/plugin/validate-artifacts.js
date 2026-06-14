import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { safeJsonParse } from "../shared/json.js";
import { validatePluginManifest } from "./manifest.js";
import { validateMcpConfig } from "./mcp-config.js";
const REQUIRED_FILES = [
    ".codex-plugin/plugin.json",
    ".mcp.json",
    "scripts/bootstrap-mcp.mjs",
    "skills/repo-memory/SKILL.md",
    "skills/repo-memory/agents/openai.yaml",
    "assets/icon.png",
    "assets/logo.png"
];
export function validatePluginArtifacts(root) {
    const missing = [];
    const warnings = [];
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
    validateSkill(root, warnings);
    validateSkillAgent(root, warnings);
    validatePng(path.join(root, "assets/icon.png"), "assets/icon.png", warnings);
    validatePng(path.join(root, "assets/logo.png"), "assets/logo.png", warnings);
    return { ok: missing.length === 0 && warnings.length === 0, missing, warnings };
}
function validateJsonFile(root, relativePath, warnings, validator) {
    const fullPath = path.join(root, relativePath);
    const parsed = safeJsonParse(readFileSync(fullPath, "utf8"));
    if (!parsed.ok) {
        warnings.push(`${relativePath}: invalid JSON`);
        return;
    }
    try {
        validator(parsed.value);
        if (containsUnsafePath(parsed.value)) {
            warnings.push(`${relativePath}: contains unsafe path`);
        }
    }
    catch (error) {
        warnings.push(`${relativePath}: ${error instanceof Error ? error.message : "invalid"}`);
    }
}
function validateSkill(root, warnings) {
    const text = readFileSync(path.join(root, "skills/repo-memory/SKILL.md"), "utf8");
    if (!text.startsWith("---\n")) {
        warnings.push("skills/repo-memory/SKILL.md: missing YAML frontmatter");
    }
    for (const required of ["Supported lifecycle", "memory.agent", "memory.head", "memory.query", "memory.duplicates", "memory.refresh", "Do not read `.codex/memory/memory.db` directly", "implicit skill policy"]) {
        if (!text.includes(required)) {
            warnings.push(`skills/repo-memory/SKILL.md: missing ${required}`);
        }
    }
}
function validateSkillAgent(root, warnings) {
    const text = readFileSync(path.join(root, "skills/repo-memory/agents/openai.yaml"), "utf8");
    for (const required of ["allow_implicit_invocation: true", "memory.agent", "memory.head", "memory.query", "memory.duplicates", "memory.frame", "memory.refresh", "memory.diff"]) {
        if (!text.includes(required)) {
            warnings.push(`skills/repo-memory/agents/openai.yaml: missing ${required}`);
        }
    }
}
function validatePng(fullPath, relativePath, warnings) {
    const bytes = readFileSync(fullPath);
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (!isPng) {
        warnings.push(`${relativePath}: invalid PNG`);
    }
}
function containsUnsafePath(value) {
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
//# sourceMappingURL=validate-artifacts.js.map