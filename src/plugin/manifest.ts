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
    version: z.literal("0.1.0"),
    mcp: z.object({
      command: z.literal("node"),
      args: z.tuple([z.literal("dist/mcp/server.js")])
    }).strict(),
    skills: z.array(
      z.object({
        name: z.literal("repo-memory"),
        path: z.literal("skills/repo-memory/SKILL.md")
      }).strict()
    ).length(1),
    hooks: z.object({ path: z.literal("hooks/hooks.json") }).strict(),
    assets: z.object({
      icon: z.literal("assets/icon.png"),
      logo: z.literal("assets/logo.png")
    }).strict()
  })
  .strict();

export function buildPluginManifest(options: PluginManifestOptions): PluginManifest {
  const manifest: PluginManifest = {
    name: options.packageName,
    version: options.version,
    mcp: {
      command: "node",
      args: [options.mcpServerPath]
    },
    skills: [
      {
        name: "repo-memory",
        path: options.skillPath
      }
    ],
    hooks: options.hooksConfigPath ? { path: options.hooksConfigPath } : undefined,
    assets: options.assets
      ? {
          icon: options.assets.iconPng,
          logo: options.assets.logoPng
        }
      : undefined
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
    ...manifest.mcp.args,
    ...manifest.skills.map((skill) => skill.path),
    manifest.hooks?.path,
    manifest.assets?.icon,
    manifest.assets?.logo
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
