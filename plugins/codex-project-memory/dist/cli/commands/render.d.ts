import type { CliResult, RenderOutput } from "../../shared/types.js";
export interface RenderCliOptions {
    cwd: string;
    png?: boolean;
    frame?: string;
}
export declare function cmdRender(options: RenderCliOptions): Promise<CliResult<RenderOutput>>;
