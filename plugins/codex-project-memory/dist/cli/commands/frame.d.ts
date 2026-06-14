import type { CliResult, FrameOutput } from "../../shared/types.js";
export interface FrameCliOptions {
    cwd: string;
    frame: string;
}
export declare function cmdFrame(options: FrameCliOptions): Promise<CliResult<FrameOutput>>;
