import type { ProjectMemoryConfig, ScannedFile } from "../shared/types.js";
export declare function scanProjectFiles(root: string, config: ProjectMemoryConfig): Promise<ScannedFile[]>;
