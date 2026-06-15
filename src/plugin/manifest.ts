import path from "node:path";
import { z } from "zod";
import { PmemError } from "../shared/errors.js";
import type { PluginManifest, PluginManifestOptions } from "../shared/types.js";

const relativePathSchema = z.string().min(1).refine(isSafeRelativePath, {
  message: "Path must be relative POSIX without traversal."
});

const pluginManifestSchema = z
  .object({
    name: z.literal("codex-project-memory"),
    version: z.literal("0.4.2"),
    description: z.string().min(1),
    author: z.object({ name: z.string().min(1), email: z.string().optional(), url: z.string().url().optional() }).strict(),
    skills: z.literal("./skills/"),
    mcpServers: z.literal("./.mcp.json"),
    keywords: z.array(z.string().min(1)),
    interface: z
      .object({
        displayName: z.literal("Codex Project Memory"),
        shortDescription: z.string().min(1),
        longDescription: z.string().min(1),
        developerName: z.string().min(1),
        category: z.literal("Productivity"),
        capabilities: z.array(z.string().min(1)),
        defaultPrompt: z.array(z.string().min(1)).min(1).max(3),
        brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        composerIcon: z.literal("./assets/icon.png").optional(),
        logo: z.literal("./assets/logo.png").optional()
      })
      .strict()
  })
  .strict();

export function buildPluginManifest(options: PluginManifestOptions): PluginManifest {
  const manifest: PluginManifest = {
    name: options.packageName,
    version: options.version,
    description: options.description ?? "Local repository memory for Codex with SQLite, deterministic frames, MCP tools, lazy compiler diagnostics and an implicit skill lifecycle.",
    author: {
      name: "Project Memory Maintainers"
    },
    skills: options.skillsPath ?? "./skills/",
    mcpServers: options.mcpConfigPath ?? "./.mcp.json",
    keywords: ["codex", "memory", "mcp", "repository"],
    interface: {
      displayName: "Codex Project Memory",
      shortDescription: "Local repository memory for Codex.",
      longDescription: "Indexes repository structure into local SQLite, exposes compact MCP tools, renders deterministic SVG maps, adds lazy compiler-assisted diagnostics and uses Codex-supported implicit skill invocation as the project lifecycle.",
      developerName: "Project Memory Maintainers",
      category: "Productivity",
      capabilities: ["MCP", "CLI", "Implicit Skill"],
      defaultPrompt: ["Query project memory before implementing.", "Check duplicate risk for a new service.", "Refresh project memory after code changes."],
      brandColor: "#2563EB",
      composerIcon: options.assets?.iconPng ? `./${options.assets.iconPng}` : undefined,
      logo: options.assets?.logoPng ? `./${options.assets.logoPng}` : undefined
    }
  };

  validateRelativeFields(manifest);
  return validatePluginManifest(manifest);
}

export function validatePluginManifest(value: unknown): PluginManifest {
  const result = pluginManifestSchema.safeParse(value);
  if (!result.success) {
    throw new PmemError("CONFIG_ERROR", "Plugin manifest is invalid.", {
      details: { issues: result.error.issues.map((issue) => issue.message) }
    });
  }

  return result.data;
}

function validateRelativeFields(manifest: PluginManifest): void {
  const paths = [
    manifest.skills,
    manifest.mcpServers,
    manifest.interface.composerIcon,
    manifest.interface.logo
  ].filter((value): value is string => Boolean(value));

  for (const item of paths) {
    const result = relativePathSchema.safeParse(item);
    if (!result.success) {
      throw new PmemError("VALIDATION_ERROR", "Plugin manifest contains an invalid path.");
    }
  }
}

function isSafeRelativePath(value: string): boolean {
  return !path.isAbsolute(value) && !value.includes("\\") && !value.split("/").includes("..");
}
