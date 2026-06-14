export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type MemoryStatus = "not_initialized" | "initializing" | "fresh" | "stale" | "dirty" | "error";
export type MemoryEvent =
  | "init_started"
  | "init_completed"
  | "index_started"
  | "index_completed"
  | "render_completed"
  | "mark_dirty"
  | "mark_error"
  | "doctor_ok";

export type LanguageKind = "typescript" | "javascript";

export type ArtifactKind =
  | "service"
  | "controller"
  | "dto"
  | "type"
  | "interface"
  | "enum"
  | "repository"
  | "utility"
  | "route"
  | "migration"
  | "table"
  | "job"
  | "adapter"
  | "module"
  | "feature"
  | "class"
  | "function"
  | "method"
  | "const"
  | "provider";

export type WarningSeverity = "info" | "warning" | "critical";
export type WarningSource = "parser" | "indexer" | "renderer" | "agent" | "hook" | "mcp" | "config" | "inferred";
export type RiskLevel = "low" | "medium" | "high";
export type DuplicateVerdict = "create_new_artifact" | "extend_existing_artifact" | "needs_human_review";
export type FrameName = "current" | "overview" | "modules" | "duplicates" | "risks";
export type FrameType = "current" | "overview" | "module_map" | "duplicate_map" | "risk_map";
export type AgentName = "retrieval" | "duplicate" | "drift" | "architecture" | "render";

export const PMEM_ERROR_CODES = [
  "INVALID_INPUT",
  "VALIDATION_ERROR",
  "NOT_INITIALIZED",
  "ALREADY_EXISTS",
  "CONFIG_ERROR",
  "FS_ERROR",
  "DB_ERROR",
  "INDEX_ERROR",
  "RENDER_ERROR",
  "AGENT_ERROR",
  "MCP_ERROR",
  "HOOK_ERROR",
  "SAFETY_ERROR",
  "STATE_ERROR",
  "FRAME_NOT_FOUND",
  "TEMPLATE_ERROR",
  "INTERNAL_ERROR"
] as const;

export type PmemErrorCode = (typeof PMEM_ERROR_CODES)[number];

export interface ErrorPayload {
  code: PmemErrorCode;
  message: string;
  recoverable: boolean;
  details?: JsonObject;
}

export interface CliResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: ErrorPayload;
  warnings: string[];
}

export interface CommonCliOptions {
  json: boolean;
  cwd: string;
  verbose: boolean;
}

export interface CliOutputOptions {
  json: boolean;
  verbose?: boolean;
}

export interface PluginAssetPaths {
  iconPng: string;
  logoPng: string;
}

export interface PluginManifestOptions {
  packageName: string;
  version: string;
  mcpServerPath: string;
  skillPath: string;
  hooksConfigPath?: string;
  assets?: PluginAssetPaths;
}

export interface PluginManifest {
  name: string;
  version: string;
  mcp: { command: string; args: string[] };
  skills: Array<{ name: string; path: string }>;
  hooks?: { path: string };
  assets?: { icon?: string; logo?: string };
}

export interface McpConfigOptions {
  serverName: "project-memory";
  command: string;
  args: string[];
}

export interface McpConfig {
  mcpServers: Record<string, { command: string; args: string[] }>;
}

export interface SkillDocOptions {
  pluginName: string;
  cliCommand: "pmem";
  mcpServerName: "project-memory";
}

export interface HooksConfigOptions {
  pluginRootVar?: "${PLUGIN_ROOT}";
}

export interface HooksConfig {
  hooks: JsonObject;
}

export interface PluginArtifactValidationResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
}
