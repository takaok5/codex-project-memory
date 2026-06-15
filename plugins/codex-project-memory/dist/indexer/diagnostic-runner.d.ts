import type { DiagnosticInput, DiagnosticsOutput, RuntimeContext } from "../shared/types.js";
export interface DiagnosticAnalysisOptions {
    languages?: string[];
    filePaths?: string[];
    changedOnly?: boolean;
    allowInstall?: boolean;
}
export declare function runDiagnosticAnalysis(ctx: RuntimeContext, options?: DiagnosticAnalysisOptions): DiagnosticsOutput;
export declare function parseTypeScriptDiagnostics(output: string, root: string, language?: string): DiagnosticInput[];
export declare function parsePyrightDiagnostics(output: string, root: string): DiagnosticInput[];
export declare function parseGoDiagnostics(output: string, root: string): DiagnosticInput[];
export declare function parseRustDiagnostics(output: string, root: string): DiagnosticInput[];
export declare function parseGenericDiagnostics(output: string, root: string, language: string, tool: string): DiagnosticInput[];
