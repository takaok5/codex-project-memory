import { existsSync } from "node:fs";
import { join } from "node:path";
import { indexProject } from "../indexer/project-indexer.js";
import { renderCurrentFrame } from "../renderer/render-current.js";
import { findProjectRoot } from "../runtime/project-locator.js";
import { computeConfigHash, writeDefaultProjectConfig } from "../runtime/config-loader.js";
import { ensureMemoryDirectories, getMemoryPaths } from "../runtime/memory-paths.js";
import { resolveRuntimeContext } from "../runtime/context.js";
import { createMemorySnapshot, diffMemorySnapshots, readMemorySnapshot, rotateSnapshotsForWrite } from "../runtime/snapshots.js";
import { PmemError } from "../shared/errors.js";
import { ARTIFACT_KINDS } from "../shared/types.js";
import { getFrame } from "../store/frame-repository.js";
import { getProjectState, setProjectStateValue } from "../store/project-state-repository.js";
import { ensureSchema, openMemoryDb } from "../store/sqlite.js";
import { runConflictArbiter } from "./conflict-arbiter.js";
import { runDuplicateAgent } from "./duplicate-agent.js";
import { runImpactAgent } from "./impact-agent.js";
import { routeIntent } from "./intent-router.js";
import { runMemoryCurator } from "./memory-curator.js";
import { runRetrievalAgent } from "./retrieval-agent.js";
const PHASES = ["pre_task", "pre_create", "post_change", "review", "orient"];
const ARTIFACT_KIND_SET = new Set(ARTIFACT_KINDS);
export async function runProjectAgent(input, options) {
    const normalized = normalizeAgentInput(input);
    const actions = [];
    const warnings = [];
    let head = readHead(options.cwd);
    actions.push({ name: "head", status: "completed", reason: `memory status: ${head.status}` });
    const route = routeIntent({ intent: normalized.intent, phase: normalized.phase, artifact: normalized.artifact });
    actions.push({ name: "router", status: "completed", reason: route.reason });
    let initialized = false;
    let refreshed = false;
    let refresh;
    if (head.status === "not_initialized") {
        if (!normalized.allowInit) {
            actions.push({ name: "init", status: "blocked", reason: "allowInit=false" });
            return buildOutput({
                status: "blocked",
                actions,
                head,
                route,
                warnings,
                decision: {
                    verdict: "blocked",
                    message: "Project memory is not initialized.",
                    filesToOpen: [],
                    nextCommands: ["pmem init --json"]
                }
            });
        }
        initializeMemory(options.cwd);
        initialized = true;
        actions.push({ name: "init", status: "completed", reason: "created project memory" });
        head = readHead(options.cwd);
    }
    else {
        actions.push({ name: "init", status: "skipped", reason: "memory already initialized" });
    }
    const shouldRefresh = normalized.allowRefresh && (initialized || head.status === "dirty" || head.status === "stale" || normalized.phase === "post_change");
    if (shouldRefresh) {
        refresh = await refreshMemory(options.cwd, normalized.render, normalized.phase);
        refreshed = true;
        warnings.push(...collectRefreshWarnings(refresh));
        actions.push({ name: "refresh", status: "completed", reason: normalized.render ? "indexed changed files and rendered current frame" : "indexed changed files without render" });
        head = readHead(options.cwd);
    }
    else {
        actions.push({ name: "refresh", status: "skipped", reason: normalized.allowRefresh ? "memory is already fresh" : "allowRefresh=false" });
    }
    let query;
    if (shouldQuery(normalized.phase)) {
        query = queryMemory(options.cwd, normalized.intent, normalized.phase === "orient", route);
        actions.push({ name: "query", status: "completed", reason: "retrieved project context" });
    }
    else {
        actions.push({ name: "query", status: "skipped", reason: `phase=${normalized.phase}` });
    }
    let duplicates;
    if (normalized.artifact) {
        duplicates = checkDuplicates(options.cwd, normalized.intent, normalized.artifact);
        actions.push({ name: "duplicates", status: "completed", reason: `risk=${duplicates.risk}` });
    }
    else {
        actions.push({ name: "duplicates", status: "skipped", reason: "no artifact provided" });
    }
    let frame;
    if (normalized.phase === "orient") {
        frame = readFrame(options.cwd, "current");
        actions.push({ name: "frame", status: "completed", reason: "returned current frame" });
    }
    else {
        actions.push({ name: "frame", status: "skipped", reason: `phase=${normalized.phase}` });
    }
    let diff;
    if (normalized.phase === "review" || normalized.phase === "post_change") {
        diff = diffMemory(options.cwd);
        warnings.push(...diffWarnings(diff));
        actions.push({ name: "diff", status: "completed", reason: "compared previous and current memory snapshots" });
    }
    else {
        actions.push({ name: "diff", status: "skipped", reason: `phase=${normalized.phase}` });
    }
    if (route.agents.includes("runtime-evidence-importer")) {
        actions.push({ name: "runtime-evidence", status: diff ? "completed" : "skipped", reason: diff ? "imported diff and diagnostics evidence" : "no runtime evidence for this phase" });
    }
    let impact;
    if (route.agents.includes("impact-assessor")) {
        impact = assessImpact(options.cwd, normalized.intent, query, duplicates, diff);
        actions.push({ name: "impact", status: "completed", reason: impact.summary });
    }
    else {
        actions.push({ name: "impact", status: "skipped", reason: `phase=${normalized.phase}` });
    }
    let curation;
    if (route.agents.includes("memory-curator")) {
        curation = runMemoryCurator({ phase: normalized.phase, query, duplicates, impact, diff });
        actions.push({ name: "curator", status: "completed", reason: `${curation.accepted.length} accepted, ${curation.rejected.length} rejected` });
    }
    else {
        actions.push({ name: "curator", status: "skipped", reason: `phase=${normalized.phase}` });
    }
    let conflicts;
    if (route.agents.includes("conflict-arbiter")) {
        conflicts = runConflictArbiter({ query, duplicates, impact, curation, diff });
        actions.push({ name: "conflict", status: "completed", reason: conflicts.status });
    }
    else {
        actions.push({ name: "conflict", status: "skipped", reason: `phase=${normalized.phase}` });
    }
    actions.push({ name: "compressor", status: "completed", reason: query ? `evidence budget ${query.contextPack.budget.usedItems}/${query.contextPack.budget.maxItems}` : `route budget ${route.budget.maxEvidenceItems}` });
    const decision = decide({ query, duplicates, conflicts, initialized, refreshed });
    return buildOutput({
        status: statusFromDecision(decision.verdict, initialized, refreshed),
        actions,
        head,
        route,
        query,
        duplicates,
        impact,
        curation,
        conflicts,
        refresh,
        frame,
        diff,
        decision,
        warnings
    });
}
function normalizeAgentInput(input) {
    const intent = validateIntent(input.intent);
    const phase = input.phase ?? "pre_task";
    if (!PHASES.includes(phase)) {
        throw new PmemError("VALIDATION_ERROR", "Agent phase is invalid.");
    }
    if (phase === "pre_create" && !input.artifact?.kind) {
        throw new PmemError("VALIDATION_ERROR", "pre_create phase requires artifact.kind.");
    }
    const artifact = input.artifact ? validateArtifact(input.artifact) : undefined;
    return {
        intent,
        phase,
        artifact,
        allowInit: input.allowInit ?? true,
        allowRefresh: input.allowRefresh ?? true,
        render: input.render ?? true
    };
}
function validateIntent(value) {
    const intent = value.trim();
    if (intent.length < 3 || intent.length > 500) {
        throw new PmemError("VALIDATION_ERROR", "Intent must be between 3 and 500 characters.");
    }
    return intent;
}
function validateArtifact(artifact) {
    if (!ARTIFACT_KIND_SET.has(artifact.kind)) {
        throw new PmemError("VALIDATION_ERROR", "Artifact kind is invalid.");
    }
    return {
        kind: artifact.kind,
        moduleId: artifact.moduleId?.trim() || undefined,
        proposedName: artifact.proposedName?.trim() || undefined
    };
}
function readHead(cwd) {
    const root = findProjectRoot(cwd).root;
    const paths = getMemoryPaths(root);
    if (!existsSync(paths.configAbs) || !existsSync(paths.dbAbs)) {
        return notInitializedHead();
    }
    const db = openMemoryDb(paths);
    try {
        const state = getProjectState(db);
        const currentFrame = getFrame(db, "current");
        const activeWarnings = db.prepare("SELECT COUNT(*) AS count FROM warnings WHERE resolved_at IS NULL").get().count;
        return {
            status: state.status,
            memoryRoot: paths.memoryRootRel,
            schemaVersion: state.schemaVersion,
            lastIndexedAt: state.lastIndexedAt,
            lastRenderedAt: state.lastRenderedAt,
            memoryDirty: state.memoryDirty,
            dirtyReason: state.dirtyReason,
            lastError: state.lastError,
            currentFrame: currentFrame
                ? {
                    frame: currentFrame.id,
                    svg: currentFrame.svgPath,
                    png: currentFrame.pngPath,
                    map: currentFrame.mapPath,
                    sourceHash: currentFrame.sourceHash,
                    generatedAt: currentFrame.generatedAt
                }
                : null,
            activeWarnings
        };
    }
    finally {
        db.close();
    }
}
function notInitializedHead() {
    return {
        status: "not_initialized",
        memoryRoot: ".codex/memory",
        schemaVersion: null,
        lastIndexedAt: null,
        lastRenderedAt: null,
        memoryDirty: false,
        dirtyReason: "",
        lastError: null,
        currentFrame: null,
        activeWarnings: 0
    };
}
function initializeMemory(cwd) {
    const root = findProjectRoot(cwd).root;
    const paths = getMemoryPaths(root);
    ensureMemoryDirectories(paths);
    const config = writeDefaultProjectConfig(paths, { force: false });
    const db = openMemoryDb(paths);
    try {
        ensureSchema(db);
        setProjectStateValue(db, "project_name", config.projectName);
        setProjectStateValue(db, "config_hash", computeConfigHash(config));
        setProjectStateValue(db, "memory_status", "fresh");
        setProjectStateValue(db, "memory_dirty", "false");
        setProjectStateValue(db, "dirty_reason", "");
        setProjectStateValue(db, "last_error", "");
    }
    finally {
        db.close();
    }
}
async function refreshMemory(cwd, render, phase) {
    const ctx = resolveRuntimeContext({ cwd, openDb: true });
    const db = ctx.db;
    try {
        rotateSnapshotsForWrite(ctx);
        const index = await indexProject(ctx, { changedOnly: true, reason: `agent:${phase}` });
        let frames = [];
        let pngExported = false;
        if (render) {
            const rendered = await renderCurrentFrame(ctx, { writeSnapshot: true });
            frames = [{ frame: rendered.frame, svg: rendered.svg, png: rendered.png, map: rendered.map, sourceHash: rendered.sourceHash }];
            pngExported = rendered.png !== null;
        }
        else {
            setProjectStateValue(db, "memory_status", "stale");
            createMemorySnapshot(ctx, { ref: "latest", write: true });
        }
        const state = getProjectState(db);
        return {
            changedOnly: true,
            reason: `agent:${phase}`,
            index: {
                filesScanned: index.scannedFiles,
                filesIndexed: index.indexedFiles,
                filesDeleted: index.deletedFiles,
                warningsActive: index.warningCount
            },
            render: { skipped: !render, frames, pngExported },
            state: { status: state.status, memoryDirty: state.memoryDirty }
        };
    }
    finally {
        db.close();
    }
}
function queryMemory(cwd, intent, visual, route) {
    const ctx = resolveRuntimeContext({ cwd, openDb: true });
    const db = ctx.db;
    try {
        return runRetrievalAgent(ctx, {
            intent,
            maxFiles: clampInt(Math.min(ctx.config.agents.maxFiles ?? 8, route.budget.maxFiles), 1, 20),
            maxSymbols: clampInt(Math.min(ctx.config.agents.maxSymbols ?? 12, route.budget.maxSymbols), 1, 40),
            maxWarnings: clampInt(Math.min(ctx.config.agents.maxWarnings ?? 8, route.budget.maxWarnings), 0, 20),
            maxEvidenceItems: route.budget.maxEvidenceItems,
            minScore: Math.round(route.minConfidence * 40),
            includeVisualFrame: visual
        });
    }
    finally {
        db.close();
    }
}
function assessImpact(cwd, intent, query, duplicates, diff) {
    const ctx = resolveRuntimeContext({ cwd, openDb: true });
    const db = ctx.db;
    try {
        return runImpactAgent(ctx, { intent, query, duplicates, diff });
    }
    finally {
        db.close();
    }
}
function checkDuplicates(cwd, intent, artifact) {
    const ctx = resolveRuntimeContext({ cwd, openDb: true });
    const db = ctx.db;
    try {
        return runDuplicateAgent(ctx, {
            intent,
            kind: artifact.kind,
            moduleId: artifact.moduleId,
            proposedName: artifact.proposedName
        });
    }
    finally {
        db.close();
    }
}
function readFrame(cwd, frameName) {
    const ctx = resolveRuntimeContext({ cwd, openDb: true });
    const db = ctx.db;
    try {
        const record = getFrame(db, frameName);
        if (!record || !existsSync(join(ctx.projectRoot, record.svgPath)) || !existsSync(join(ctx.projectRoot, record.mapPath))) {
            throw new PmemError("FRAME_NOT_FOUND", "Requested memory frame was not found.", { details: { nextCommand: "pmem render --json" } });
        }
        return {
            frame: record.id,
            svg: record.svgPath,
            png: record.pngPath && existsSync(join(ctx.projectRoot, record.pngPath)) ? record.pngPath : null,
            map: record.mapPath,
            sourceHash: record.sourceHash,
            generatedAt: record.generatedAt,
            summary: {
                nodes: Number(db.prepare("SELECT COUNT(*) AS count FROM modules").get().count),
                edges: Number(db.prepare("SELECT COUNT(*) AS count FROM symbol_edges").get().count),
                warnings: Number(db.prepare("SELECT COUNT(*) AS count FROM warnings WHERE resolved_at IS NULL").get().count)
            }
        };
    }
    finally {
        db.close();
    }
}
function diffMemory(cwd) {
    const ctx = resolveRuntimeContext({ cwd, openDb: true });
    const db = ctx.db;
    try {
        const from = readMemorySnapshot(ctx, "previous");
        const to = readMemorySnapshot(ctx, "current");
        const diff = diffMemorySnapshots(from.snapshot, to.snapshot);
        return {
            from: "previous",
            to: "current",
            ...diff,
            changedWarnings: diff.changedWarnings
        };
    }
    finally {
        db.close();
    }
}
function decide(input) {
    if (input.duplicates?.risk === "high") {
        return {
            verdict: "extend_existing_artifact",
            message: input.duplicates.recommendation,
            filesToOpen: filesToOpen(input.query, input.duplicates),
            nextCommands: ["memory.query"]
        };
    }
    if (input.duplicates?.risk === "medium") {
        return {
            verdict: "needs_human_review",
            message: input.duplicates.recommendation,
            filesToOpen: filesToOpen(input.query, input.duplicates),
            nextCommands: ["memory.duplicates"]
        };
    }
    if (input.conflicts?.items.some((item) => item.severity === "critical")) {
        return {
            verdict: "needs_human_review",
            message: input.conflicts.items.find((item) => item.severity === "critical")?.resolution ?? "Resolve memory conflict before continuing.",
            filesToOpen: filesToOpen(input.query, input.duplicates),
            nextCommands: ["memory.agent"]
        };
    }
    const verdict = input.duplicates?.risk === "low" ? "create_new_artifact" : "continue";
    return {
        verdict,
        message: input.refreshed
            ? "Project memory is refreshed and ready."
            : input.initialized
                ? "Project memory is initialized and ready."
                : "Project memory is ready.",
        filesToOpen: filesToOpen(input.query, input.duplicates),
        nextCommands: ["memory.refresh"]
    };
}
function statusFromDecision(verdict, initialized, refreshed) {
    if (verdict === "extend_existing_artifact" || verdict === "blocked")
        return "blocked";
    if (verdict === "needs_human_review")
        return "needs_review";
    if (refreshed)
        return "refreshed";
    if (initialized)
        return "initialized";
    return "ready";
}
function filesToOpen(query, duplicates) {
    const values = [
        ...(query?.contextPack.files.map((file) => file.path) ?? []),
        ...(query?.contextPack.symbols.map((symbol) => symbol.filePath) ?? []),
        ...(duplicates?.matches.flatMap((match) => [match.filePath, match.path].filter((value) => Boolean(value))) ?? [])
    ];
    return [...new Set(values)].slice(0, 12);
}
function shouldQuery(phase) {
    return phase === "pre_task" || phase === "pre_create" || phase === "post_change" || phase === "review";
}
function collectRefreshWarnings(refresh) {
    if (refresh.render.skipped) {
        return ["render_skipped: visual frame may be stale"];
    }
    if (!refresh.render.pngExported) {
        return ["png_missing"];
    }
    return [];
}
function diffWarnings(diff) {
    const warnings = [];
    if (diff.changedFiles.length === 0 && diff.addedFiles.length === 0 && diff.removedFiles.length === 0) {
        warnings.push("snapshot_missing: previous");
    }
    return warnings;
}
function buildOutput(input) {
    return {
        version: 2,
        status: input.status,
        actions: input.actions,
        head: input.head,
        ...(input.route ? { route: input.route } : {}),
        ...(input.query ? { query: input.query } : {}),
        ...(input.duplicates ? { duplicates: input.duplicates } : {}),
        ...(input.impact ? { impact: input.impact } : {}),
        ...(input.curation ? { curation: input.curation } : {}),
        ...(input.conflicts ? { conflicts: input.conflicts } : {}),
        ...(input.refresh ? { refresh: input.refresh } : {}),
        ...(input.frame ? { frame: input.frame } : {}),
        ...(input.diff ? { diff: input.diff } : {}),
        decision: input.decision,
        warnings: [...new Set(input.warnings)]
    };
}
function clampInt(value, min, max) {
    return Math.max(min, Math.min(max, Math.trunc(value)));
}
//# sourceMappingURL=project-agent.js.map