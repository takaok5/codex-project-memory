import type { MemoryPaths, ProjectMemoryConfig } from "../shared/types.js";
export declare function defaultProjectConfig(projectName?: string): ProjectMemoryConfig;
export declare function loadProjectConfig(paths: MemoryPaths, options?: {
    allowMissing?: boolean;
}): ProjectMemoryConfig;
export declare function writeDefaultProjectConfig(paths: MemoryPaths, options?: {
    force?: boolean;
}): ProjectMemoryConfig;
export declare function validateProjectConfig(value: unknown): ProjectMemoryConfig;
export declare function computeConfigHash(config: ProjectMemoryConfig): string;
