export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
    [key: string]: JsonValue;
}
export type MemoryStatus = "not_initialized" | "initializing" | "fresh" | "stale" | "dirty" | "error";
export type MemoryEvent = "init_started" | "init_completed" | "index_started" | "index_completed" | "render_completed" | "mark_dirty" | "mark_error" | "doctor_ok";
export type LanguageId = string;
export type LanguageKind = LanguageId;
export type LanguageAnalysisTier = "deep" | "structural" | "fallback";
export type LanguageToolStatus = "available" | "missing" | "installing" | "failed" | "disabled" | "unsupported";
export type DiagnosticSeverity = "error" | "warning" | "info";
export interface LanguageCapability {
    language: LanguageId;
    displayName: string;
    tier: LanguageAnalysisTier;
    parser: string;
    symbols: boolean;
    dependencies: boolean;
    tests: boolean;
    routes: boolean;
    diagnostics: boolean;
    tool: string | null;
    toolStatus: LanguageToolStatus;
    degradedReason: string | null;
}
export interface DiagnosticInput {
    language: LanguageId;
    filePath: string;
    severity: DiagnosticSeverity;
    code: string | null;
    message: string;
    startLine: number | null;
    endLine: number | null;
    source: "compiler" | "lsp" | "tool" | "fallback";
    tool: string;
    confidence: number;
}
export interface DiagnosticRecord extends DiagnosticInput {
    id: number;
    fileId: number | null;
    fingerprint: string;
    createdAt: string;
}
export declare const ARTIFACT_KINDS: readonly ["service", "controller", "dto", "type", "interface", "enum", "repository", "utility", "route", "migration", "table", "job", "adapter", "module", "feature", "class", "function", "method", "const", "provider"];
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export type WarningSeverity = "info" | "warning" | "critical";
export type WarningSource = "parser" | "indexer" | "renderer" | "agent" | "mcp" | "config" | "inferred" | "diagnostic";
export type RiskLevel = "low" | "medium" | "high";
export type DuplicateVerdict = "create_new_artifact" | "extend_existing_artifact" | "needs_human_review";
export type FrameName = "current" | "overview" | "modules" | "duplicates" | "risks";
export type FrameType = "current" | "overview" | "module_map" | "duplicate_map" | "risk_map";
export type AgentName = "retrieval" | "duplicate" | "drift" | "architecture" | "render";
export type AgentRunPhase = "pre_task" | "pre_create" | "post_change" | "review" | "orient";
export type AgentRunStatus = "ready" | "initialized" | "refreshed" | "blocked" | "needs_review";
export type AgentActionStatus = "completed" | "skipped" | "blocked";
export type AgentDecisionVerdict = "continue" | "create_new_artifact" | "extend_existing_artifact" | "needs_human_review" | "blocked";
export declare const PMEM_ERROR_CODES: readonly ["INVALID_INPUT", "VALIDATION_ERROR", "NOT_INITIALIZED", "ALREADY_EXISTS", "CONFIG_ERROR", "FS_ERROR", "DB_ERROR", "INDEX_ERROR", "RENDER_ERROR", "AGENT_ERROR", "MCP_ERROR", "SAFETY_ERROR", "STATE_ERROR", "FRAME_NOT_FOUND", "TEMPLATE_ERROR", "INTERNAL_ERROR"];
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
    description?: string;
    mcpConfigPath?: string;
    skillsPath?: string;
    assets?: PluginAssetPaths;
}
export interface PluginManifest {
    name: string;
    version: string;
    description: string;
    author: {
        name: string;
        email?: string;
        url?: string;
    };
    skills: string;
    mcpServers: string;
    keywords: string[];
    interface: {
        displayName: string;
        shortDescription: string;
        longDescription: string;
        developerName: string;
        category: string;
        capabilities: string[];
        defaultPrompt: string[];
        brandColor: string;
        composerIcon?: string;
        logo?: string;
    };
}
export interface McpConfigOptions {
    serverName: "project-memory";
    command: string;
    args: string[];
}
export interface McpConfig {
    mcpServers: Record<string, {
        command: string;
        args: string[];
    }>;
}
export interface SkillDocOptions {
    pluginName: string;
    cliCommand: "pmem";
    mcpServerName: "project-memory";
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
        languages: LanguageId[];
        maxFileBytes: number;
    };
    languageTools?: {
        autoInstall: boolean;
        cachePath: string;
        installTimeoutMs: number;
        runTimeoutMs: number;
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
    language: LanguageId | null;
    moduleId: string | null;
    hash: string;
    sizeBytes: number;
    lineCount: number;
    isTest: boolean;
    isGenerated: boolean;
    lastIndexedAt: string;
    analysis?: LanguageCapability | null;
}
export interface FileFilter {
    moduleId?: string;
    language?: LanguageId;
    isTest?: boolean;
    limit?: number;
}
export interface InitOutput {
    status: MemoryStatus;
    memoryRoot: ".codex/memory";
    config: ".codex/memory/project-memory.config.json";
    db: ".codex/memory/memory.db";
    schemaVersion: 3;
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
    languageTools?: {
        cachePath: string;
        lockfile: string;
        lockedTools: string[];
        failedTools: string[];
        diagnostics: number;
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
export interface SymbolRecord {
    id?: number;
    fileId: number;
    fqName: string;
    name: string;
    kind: ArtifactKind | "class" | "function" | "method" | "const" | "provider";
    exported: boolean;
    startLine?: number;
    endLine?: number;
    signature?: string;
    signatureHash?: string;
    bodyHash?: string;
    summary?: string;
}
export interface ImportExportEdgeInput {
    fromFileId?: number;
    fromSymbolName?: string;
    importedName: string;
    sourceModule: string;
    edgeKind: "import" | "export" | "dependency";
    resolved: boolean;
}
export interface ResolvedSymbolEdgeInput {
    fromSymbolId: number;
    toSymbolId: number;
    edgeKind: "import" | "export" | "dependency";
    confidence: number;
}
export interface SymbolEdgeRecord extends ResolvedSymbolEdgeInput {
    id?: number;
    sourceFileId: number;
}
export interface ModuleRecord {
    id: string;
    name: string;
    rootPath?: string;
    summary?: string;
    owns: string[];
    mustNot: string[];
    dependencies: string[];
    riskLevel: "normal" | "high";
    updatedAt: string;
}
export interface RouteRecordInput {
    method: string;
    path: string;
    handlerSymbolId?: number;
    moduleId?: string;
}
export interface RouteRecord extends RouteRecordInput {
    id?: number;
    fileId: number;
}
export interface TestLinkRecord {
    fileId: number;
    targetSymbolId?: number;
    testKind: "unit" | "integration" | "e2e" | "unknown";
    summary?: string;
}
export interface WarningRecordInput {
    warningType: string;
    severity: WarningSeverity;
    moduleId?: string;
    fileId?: number;
    symbolId?: number;
    message: string;
    recommendation?: string;
    source: WarningSource;
    confidence: number;
}
export interface WarningRecord extends WarningRecordInput {
    id: number;
    createdAt: string;
    resolvedAt?: string | null;
}
export interface SymbolSearchQuery {
    query?: string;
    moduleId?: string;
    filePath?: string;
    kind?: string;
    limit?: number;
}
export interface ScannedFile {
    path: string;
    absPath: string;
    language: LanguageId | null;
    displayName: string | null;
    sizeBytes: number;
    hash: string;
    isTest: boolean;
    isGenerated: boolean;
}
export interface AstIndexOptions {
    fileId: number;
    moduleId: string | null;
}
export interface AstIndexResult {
    file: IndexedFileRecord;
    symbols: SymbolRecord[];
    imports: ImportExportEdgeInput[];
    routes: RouteRecordInput[];
    testLinks: TestLinkRecord[];
    warnings: WarningRecordInput[];
    capability?: LanguageCapability;
}
export interface IndexOptions {
    changedOnly?: boolean;
    render?: boolean;
    reason?: string;
}
export interface IndexResult {
    scannedFiles: number;
    indexedFiles: number;
    skippedFiles: number;
    deletedFiles: number;
    warningCount: number;
    status: MemoryStatus;
}
export interface ScanOutput {
    files: {
        scanned: number;
        included: number;
        excluded: number;
        tooLarge: number;
        unsupported: number;
    };
    roots: string[];
    warnings: string[];
}
export interface IndexOutput {
    changedOnly: boolean;
    files: {
        scanned: number;
        indexed: number;
        skippedUnchanged: number;
        deleted: number;
        failed: number;
    };
    records: {
        modules: number;
        symbols: number;
        symbolEdges: number;
        routes: number;
        tests: number;
        warningsActive: number;
        warningsAdded: number;
        warningsResolved: number;
    };
    state: {
        status: MemoryStatus;
        memoryDirty: boolean;
    };
}
export interface ContextPack {
    summary: string;
    modules: ContextModule[];
    files: ContextFile[];
    symbols: ContextSymbol[];
    constraints: string[];
    warnings: ContextWarning[];
    nextCommands: string[];
    visualFrame?: FrameRef;
}
export interface ContextModule {
    id: string;
    name: string;
    reason: string;
    score: number;
}
export interface ContextFile {
    path: string;
    moduleId?: string;
    reason: string;
    score: number;
    isTest?: boolean;
}
export interface ContextSymbol {
    fqName: string;
    kind: string;
    filePath: string;
    reason: string;
    score: number;
}
export interface ContextWarning {
    severity: WarningSeverity;
    message: string;
    filePath?: string;
    recommendation?: string;
}
export interface DiagnosticsOutput {
    languages: string[];
    diagnostics: Array<{
        language: string;
        filePath: string;
        severity: DiagnosticSeverity;
        code: string | null;
        message: string;
        startLine: number | null;
        endLine: number | null;
        source: string;
        tool: string;
        confidence: number;
    }>;
    summary: {
        total: number;
        errors: number;
        warnings: number;
        info: number;
        failedTools: string[];
        degradedLanguages: string[];
    };
}
export interface FrameRef {
    frame: FrameName;
    svg: string;
    png: string | null;
    map: string;
}
export interface QueryOutput {
    intent: string;
    contextPack: ContextPack;
}
export interface DuplicateCandidate {
    kind: ArtifactKind;
    symbolId?: number;
    fileId?: number;
    name: string;
    fqName?: string;
    filePath?: string;
    path?: string;
    moduleId?: string;
    similarity: number;
    reason: string;
}
export interface DuplicateOutput {
    kind: ArtifactKind;
    intent: string;
    risk: RiskLevel;
    verdict: DuplicateVerdict;
    matches: DuplicateCandidate[];
    recommendation: string;
}
export interface AgentArtifactInput {
    kind: ArtifactKind;
    moduleId?: string;
    proposedName?: string;
}
export interface AgentRunInput {
    intent: string;
    phase?: AgentRunPhase;
    artifact?: AgentArtifactInput;
    allowInit?: boolean;
    allowRefresh?: boolean;
    render?: boolean;
}
export interface AgentAction {
    name: "head" | "init" | "refresh" | "query" | "duplicates" | "frame" | "diff";
    status: AgentActionStatus;
    reason: string;
}
export interface AgentDecision {
    verdict: AgentDecisionVerdict;
    message: string;
    filesToOpen: string[];
    nextCommands: string[];
}
export interface AgentRunOutput {
    version: 2;
    status: AgentRunStatus;
    actions: AgentAction[];
    head: HeadOutput;
    query?: QueryOutput;
    duplicates?: DuplicateOutput;
    refresh?: RefreshOutput;
    frame?: FrameOutput;
    diff?: DiffOutput;
    decision: AgentDecision;
    warnings: string[];
}
export interface RefreshOutput {
    changedOnly: true;
    reason: string;
    index: {
        filesScanned: number;
        filesIndexed: number;
        filesDeleted: number;
        warningsActive: number;
    };
    render: {
        skipped: boolean;
        frames: CliFramePath[];
        pngExported: boolean;
    };
    state: {
        status: MemoryStatus;
        memoryDirty: boolean;
    };
}
export interface RetrievalAgentInput {
    intent: string;
    maxFiles: number;
    maxSymbols: number;
    maxWarnings: number;
    includeVisualFrame: boolean;
}
export interface DuplicateAgentInput {
    kind: ArtifactKind;
    intent: string;
    moduleId?: string;
    proposedName?: string;
}
export interface FrameRecord {
    id: FrameName;
    frameType: FrameType;
    title: string;
    svgPath: string;
    pngPath: string | null;
    mapPath: string;
    sourceHash: string;
    generatedAt: string;
}
export interface NormalizedGraph {
    version: 1;
    project: {
        name: string;
        status: MemoryStatus;
        generatedAt?: string;
    };
    languageCapabilities: JsonObject[];
    diagnostics: JsonObject[];
    modules: JsonObject[];
    files: JsonObject[];
    symbols: JsonObject[];
    routes: JsonObject[];
    warnings: JsonObject[];
    duplicateCandidates: JsonObject[];
    edges: JsonObject[];
    criticalRules: string[];
}
export interface GraphNodeLayout {
    id: string;
    kind: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    path?: string;
}
export interface GraphEdgeLayout {
    id: string;
    from: string;
    to: string;
    kind: string;
}
export interface LayoutResult {
    frame: FrameName;
    width: number;
    height: number;
    nodes: GraphNodeLayout[];
    edges: GraphEdgeLayout[];
    warnings: string[];
}
export interface LayoutOptions {
    frame?: FrameName;
    width?: number;
    columnWidth?: number;
    rowHeight?: number;
}
export interface FrameMapItem {
    id: string;
    kind: "module" | "file" | "symbol" | "route" | "warning" | "duplicate" | "rule";
    label: string;
    bbox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    paths: string[];
    symbols?: string[];
    commands: string[];
    metadata?: Record<string, JsonValue>;
}
export interface FrameMap {
    version: 1;
    frame: FrameName;
    svg: string;
    png: string | null;
    sourceHash: string;
    languageCapabilities: JsonObject[];
    items: FrameMapItem[];
}
export interface GeneratedJsonResult {
    paths: string[];
    hashes: Record<string, string>;
}
export interface RenderOptions {
    frame?: FrameName;
    png?: boolean;
    writeSnapshot?: boolean;
}
export interface PngExportResult {
    ok: boolean;
    path?: string;
    warning?: string;
}
export interface RenderResult {
    frame: FrameName;
    svg: string;
    png: string | null;
    map: string;
    generatedJson: string[];
    sourceHash: string;
    warnings: string[];
}
export interface RenderOutput {
    frames: CliFramePath[];
    generatedJson: string[];
    pngExported: boolean;
    sourceHash: string;
}
export interface FrameOutput extends CliFramePath {
    summary: {
        nodes: number;
        edges: number;
        warnings: number;
    };
}
export interface MemorySnapshot {
    version: 1;
    createdAt: string;
    schemaVersion: "1" | "2" | "3" | null;
    configHash: string | null;
    languageCapabilities: JsonObject[];
    diagnostics: Array<{
        language: string;
        filePath: string;
        severity: DiagnosticSeverity;
        code: string | null;
        fingerprint: string;
    }>;
    files: Array<{
        path: string;
        hash: string;
        moduleId: string | null;
        language?: string | null;
        tier?: LanguageAnalysisTier | null;
    }>;
    symbols: Array<{
        fqName: string;
        kind: string;
        filePath: string;
        signatureHash?: string;
        bodyHash?: string;
    }>;
    warnings: Array<{
        warningType: string;
        severity: WarningSeverity;
        filePath?: string;
        fingerprint: string;
    }>;
    frames: Array<{
        id: FrameName;
        svgPath: string;
        pngPath: string | null;
        mapPath: string;
        sourceHash: string;
    }>;
}
export type SnapshotRef = "previous" | "latest" | "current" | string;
export interface MemoryDiff {
    changedFiles: string[];
    changedModules: string[];
    addedSymbols: string[];
    removedSymbols: string[];
    newWarnings: string[];
    resolvedWarnings: string[];
    warnings: string[];
}
export interface DiffOutput {
    from: "previous" | "latest" | "current" | string;
    to: "previous" | "latest" | "current" | string;
    changedFiles: string[];
    addedFiles: string[];
    removedFiles: string[];
    changedModules: string[];
    addedSymbols: string[];
    removedSymbols: string[];
    changedWarnings: {
        added: string[];
        resolved: string[];
    };
}
export interface AgentsInstallOutput {
    scope: "project";
    installed: string[];
    skipped: string[];
    overwritten: string[];
}
export interface AgentsListOutput {
    available: Array<{
        name: string;
        template: string;
    }>;
    installed: Array<{
        name: string;
        path: string;
    }>;
}
