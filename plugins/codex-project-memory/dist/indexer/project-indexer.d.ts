import type { IndexOptions, IndexResult, RuntimeContext } from "../shared/types.js";
export declare function indexProject(ctx: RuntimeContext, options?: IndexOptions): Promise<IndexResult>;
export declare function indexChangedFiles(ctx: RuntimeContext): Promise<IndexResult>;
