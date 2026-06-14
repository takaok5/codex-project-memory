import type { ProjectRootResult } from "../shared/types.js";
export declare function findProjectRoot(startDir?: string): ProjectRootResult;
export declare function findGitRoot(startDir: string): string | null;
export declare function assertSafeProjectRoot(root: string): void;
