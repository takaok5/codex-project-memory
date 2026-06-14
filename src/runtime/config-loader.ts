import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { PmemError } from "../shared/errors.js";
import { canonicalJsonHash, safeJsonParse, writeJsonFileAtomic } from "../shared/json.js";
import { normalizePathSeparators } from "../shared/path.js";
import type { MemoryPaths, ProjectMemoryConfig } from "../shared/types.js";

const moduleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
    name: z.string().min(1).max(120),
    rootPath: z.string().optional(),
    owns: z.array(z.string()).default([]),
    mustNot: z.array(z.string()).default([]),
    dependencies: z.array(z.string()).default([]),
    riskLevel: z.enum(["normal", "high"]).default("normal")
  })
  .strict();

const configSchema = z
  .object({
    schemaVersion: z.literal(1),
    projectName: z.string().min(1).max(120),
    scan: z
      .object({
        include: z.array(z.string()).min(1),
        exclude: z.array(z.string()),
        languages: z.array(z.enum(["typescript", "javascript"])).min(1),
        maxFileBytes: z.number().int().min(1024).max(5242880)
      })
      .strict(),
    modules: z.array(moduleSchema),
    criticalRules: z.array(z.string().min(1).max(200)),
    render: z
      .object({
        png: z.boolean(),
        maxModules: z.number().int().min(1).max(200),
        maxWarnings: z.number().int().min(0).max(100)
      })
      .strict(),
    agents: z
      .object({
        maxFiles: z.number().int().min(1).max(20),
        maxSymbols: z.number().int().min(1).max(40),
        maxWarnings: z.number().int().min(0).max(20)
      })
      .strict(),
    hooks: z
      .object({
        enabled: z.boolean(),
        autoRefreshOnStop: z.boolean(),
        maxChangedFilesForStopRefresh: z.number().int().min(0).max(200)
      })
      .strict()
  })
  .strict();

export function defaultProjectConfig(projectName = "auto"): ProjectMemoryConfig {
  return {
    schemaVersion: 1,
    projectName,
    scan: {
      include: ["src/**/*", "apps/**/*", "packages/**/*"],
      exclude: ["node_modules/**", "dist/**", "build/**", "coverage/**", ".next/**", ".turbo/**", ".git/**", ".codex/memory/**"],
      languages: ["typescript", "javascript"],
      maxFileBytes: 524288
    },
    modules: [],
    criticalRules: [],
    render: { png: true, maxModules: 40, maxWarnings: 20 },
    agents: { maxFiles: 8, maxSymbols: 12, maxWarnings: 8 },
    hooks: { enabled: true, autoRefreshOnStop: true, maxChangedFilesForStopRefresh: 20 }
  };
}

export function loadProjectConfig(paths: MemoryPaths, options: { allowMissing?: boolean } = {}): ProjectMemoryConfig {
  if (!existsSync(paths.configAbs)) {
    if (options.allowMissing) {
      return defaultProjectConfig(resolveAutoProjectName(paths.projectRootAbs));
    }
    throw new PmemError("NOT_INITIALIZED", "Project memory is not initialized. Run pmem init.", {
      details: { nextCommand: "pmem init --json" }
    });
  }
  const parsed = safeJsonParse<unknown>(readFileSync(paths.configAbs, "utf8"));
  if (!parsed.ok) {
    throw new PmemError("CONFIG_ERROR", "Project memory config is invalid.", {
      details: { config: paths.configRel }
    });
  }
  return validateProjectConfig(mergeConfig(defaultProjectConfig(resolveAutoProjectName(paths.projectRootAbs)), parsed.value));
}

export function writeDefaultProjectConfig(paths: MemoryPaths, options: { force?: boolean } = {}): ProjectMemoryConfig {
  if (existsSync(paths.configAbs) && !options.force) {
    return loadProjectConfig(paths);
  }
  const config = defaultProjectConfig(resolveAutoProjectName(paths.projectRootAbs));
  writeJsonFileAtomic(paths.configAbs, config);
  return config;
}

export function validateProjectConfig(value: unknown): ProjectMemoryConfig {
  const normalized = normalizeConfig(value);
  const result = configSchema.safeParse(normalized);
  if (!result.success) {
    throw new PmemError("CONFIG_ERROR", "Project memory config is invalid.", {
      details: { issues: result.error.issues.map((issue) => issue.message) }
    });
  }
  return result.data;
}

export function computeConfigHash(config: ProjectMemoryConfig): string {
  const canonical = {
    ...config,
    scan: {
      ...config.scan,
      exclude: [...config.scan.exclude].sort(),
      languages: [...config.scan.languages].sort()
    },
    modules: config.modules
      .map((module) => ({
        ...module,
        owns: [...(module.owns ?? [])].sort(),
        mustNot: [...(module.mustNot ?? [])].sort(),
        dependencies: [...(module.dependencies ?? [])].sort()
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  };
  return canonicalJsonHash(canonical);
}

function mergeConfig(base: ProjectMemoryConfig, value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  return deepMerge(base as unknown as Record<string, unknown>, value as Record<string, unknown>);
}

function deepMerge(base: Record<string, unknown>, value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, incoming] of Object.entries(value)) {
    const current = result[key];
    if (isPlainObject(current) && isPlainObject(incoming)) {
      result[key] = deepMerge(current, incoming);
    } else {
      result[key] = incoming;
    }
  }
  return result;
}

function normalizeConfig(value: unknown): unknown {
  if (!isPlainObject(value)) {
    return value;
  }
  const config = value as unknown as ProjectMemoryConfig;
  const scan = config.scan ? { ...config.scan } : config.scan;
  if (scan) {
    scan.include = scan.include?.map(normalizePathSeparators);
    scan.exclude = Array.from(new Set([...(scan.exclude ?? []), ".codex/memory/**"].map(normalizePathSeparators)));
  }
  return {
    ...config,
    scan,
    modules: (config.modules ?? []).map((module) => ({
      ...module,
      rootPath: module.rootPath ? normalizePathSeparators(module.rootPath) : module.rootPath,
      owns: module.owns ?? [],
      mustNot: module.mustNot ?? [],
      dependencies: module.dependencies ?? [],
      riskLevel: module.riskLevel ?? "normal"
    })),
    criticalRules: config.criticalRules ?? []
  };
}

function resolveAutoProjectName(projectRoot: string): string {
  const packagePath = path.join(projectRoot, "package.json");
  if (existsSync(packagePath)) {
    const parsed = safeJsonParse<{ name?: string }>(readFileSync(packagePath, "utf8"));
    if (parsed.ok && parsed.value.name) {
      return parsed.value.name;
    }
  }
  return path.basename(projectRoot);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
