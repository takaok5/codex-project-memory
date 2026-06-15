import type { CliResult, DiagnosticsOutput } from "../../shared/types.js";
export interface DiagnosticsCliOptions {
    cwd: string;
    language?: string;
    changed?: boolean;
    install?: boolean;
}
export declare function cmdDiagnostics(options: DiagnosticsCliOptions): Promise<CliResult<DiagnosticsOutput>>;
