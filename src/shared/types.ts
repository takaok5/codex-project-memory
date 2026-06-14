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

export interface MemoryPaths {
  projectRootAbs: string;
  memoryRootAbs: string;
  memoryRootRel: ".codex/memory";
  configAbs: string;
  configRel: ".codex/memory/project-memory.config.json";
  dbAbs: string;
  dbRel: ".codex/memory/memory.db";
  currentSvgAbs: string;
  currentSvgRel: ".codex/memory/current.svg";
  currentPngAbs: string;
  currentPngRel: ".codex/memory/current.png";
  currentMapAbs: string;
  currentMapRel: ".codex/memory/current.map.json";
  framesDirAbs: string;
  framesDirRel: ".codex/memory/frames";
  generatedDirAbs: string;
  generatedDirRel: ".codex/memory/generated";
  snapshotsDirAbs: string;
  snapshotsDirRel: ".codex/memory/snapshots";
  cacheDirAbs: string;
  cacheDirRel: ".codex/memory/cache";
  logsDirAbs: string;
  logsDirRel: ".codex/memory/logs";
}

export interface ProjectMemoryConfig {
  schemaVersion: 1;
  projectName: string;
  scan: {
    include: string[];
    exclude: string[];
    languages: LanguageKind[];
    maxFileBytes: number;
  };
  modules: Array<{
    id: string;
    name: string;
    rootPath?: string;
    owns?: string[];
    mustNot?: string[];
    dependencies?: string[];
    riskLevel?: "normal" | "high";
  }>;
  criticalRules: string[];
  render: {
    png: boolean;
    maxModules: number;
    maxWarnings: number;
  };
  agents: {
    maxFiles: number;
    maxSymbols: number;
    maxWarnings: number;
  };
  hooks: {
    enabled: boolean;
    autoRefreshOnStop: boolean;
    maxChangedFilesForStopRefresh: number;
  };
}

export interface RuntimeContext {
  projectRoot: string;
  memoryPaths: MemoryPaths;
  config: ProjectMemoryConfig;
  db?: unknown;
}

export interface ProjectRootResult {
  root: string;
  method: "git" | "cwd";
  warnings: string[];
}

export interface ProjectState {
  schemaVersion: string | null;
  status: MemoryStatus;
  projectName: string | null;
  lastIndexedAt: string | null;
  lastRenderedAt: string | null;
  memoryDirty: boolean;
  dirtyReason: string;
  lastError: ErrorPayload | null;
}

export interface ResolveContextOptions {
  cwd?: string;
  allowMissingConfig?: boolean;
  openDb?: boolean;
}

export interface IndexedFileRecord {
  id?: number;
  path: string;
  language: LanguageKind | null;
  moduleId: string | null;
  hash: string;
  sizeBytes: number;
  lineCount: number;
  isTest: boolean;
  isGenerated: boolean;
  lastIndexedAt: string;
}

export interface FileFilter {
  moduleId?: string;
  language?: LanguageKind;
  isTest?: boolean;
  limit?: number;
}

export interface InitOutput {
  status: MemoryStatus;
  memoryRoot: ".codex/memory";
  config: ".codex/memory/project-memory.config.json";
  db: ".codex/memory/memory.db";
  schemaVersion: 1;
  created: string[];
  skipped: string[];
}

export interface CliCheck {
  id: string;
  status: "ok" | "warning" | "error" | "skipped";
  message: string;
  details?: JsonObject;
}

export interface CliFramePath {
  frame: FrameName;
  svg: string;
  png: string | null;
  map: string;
  sourceHash?: string;
  generatedAt?: string;
}

export interface DoctorOutput {
  overallStatus: "ok" | "warning" | "error" | "not_initialized";
  memoryRoot: ".codex/memory";
  state: {
    status: MemoryStatus;
    schemaVersion: string | null;
    lastIndexedAt: string | null;
    lastRenderedAt: string | null;
    memoryDirty: boolean;
    dirtyReason: string;
    lastError: ErrorPayload | null;
  };
  checks: CliCheck[];
  schema: {
    userVersion: number | null;
    schemaVersion: string | null;
    foreignKeysEnabled: boolean | null;
    requiredTablesPresent: boolean;
    forbiddenTables: string[];
  };
  frames: {
    current: CliFramePath | null;
    available: FrameName[];
  };
}

export interface HeadOutput {
  status: MemoryStatus;
  memoryRoot: ".codex/memory";
  schemaVersion: string | null;
  lastIndexedAt: string | null;
  lastRenderedAt: string | null;
  memoryDirty: boolean;
  dirtyReason: string;
  lastError: ErrorPayload | null;
  currentFrame: CliFramePath | null;
  activeWarnings: number;
}
