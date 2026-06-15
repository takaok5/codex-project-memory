import type { DiagnosticInput, DiagnosticRecord } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";
export declare function replaceDiagnosticsForLanguages(db: MemoryDb, languages: string[], diagnostics: DiagnosticInput[]): void;
export declare function replaceDiagnosticsForFile(db: MemoryDb, filePath: string, diagnostics: DiagnosticInput[]): void;
export declare function addDiagnostic(db: MemoryDb, diagnostic: DiagnosticInput): number;
export declare function listDiagnostics(db: MemoryDb, filter?: {
    language?: string;
    filePath?: string;
    limit?: number;
}): DiagnosticRecord[];
export declare function diagnosticFingerprint(diagnostic: DiagnosticInput): string;
