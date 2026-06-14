import type { MemoryPaths } from "./types.js";
export declare function normalizePathSeparators(value: string): string;
export declare function toProjectRelativePosix(absPath: string, projectRoot: string): string;
export declare function toMemoryRelativePosix(absPath: string, paths: MemoryPaths): string;
export declare function assertRelativePosix(value: string): string;
