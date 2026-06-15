import type { LanguageCapability } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";
export declare function upsertLanguageCapability(db: MemoryDb, capability: LanguageCapability): void;
export declare function listLanguageCapabilities(db: MemoryDb): LanguageCapability[];
