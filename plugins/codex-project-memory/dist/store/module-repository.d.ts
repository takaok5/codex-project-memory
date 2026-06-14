import type { ModuleRecord, ProjectMemoryConfig } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";
export declare function upsertModule(db: MemoryDb, module: ModuleRecord): void;
export declare function listModules(db: MemoryDb): ModuleRecord[];
export declare function inferModuleForPath(filePath: string, config: ProjectMemoryConfig): string;
export declare function upsertInferredModule(db: MemoryDb, id: string): void;
