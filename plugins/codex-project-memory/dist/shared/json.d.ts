export type JsonParseResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: string;
};
export declare function safeJsonParse<T>(text: string): JsonParseResult<T>;
export declare function stableStringify(value: unknown): string;
export declare function writeJson(value: unknown): string;
export declare function writeJsonFileAtomic(path: string, value: unknown): void;
export declare function canonicalJsonHash(value: unknown): string;
