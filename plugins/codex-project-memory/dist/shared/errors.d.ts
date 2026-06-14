import type { ErrorPayload, JsonObject, PmemErrorCode } from "./types.js";
export interface PmemErrorOptions {
    details?: JsonObject;
    recoverable?: boolean;
}
export declare class PmemError extends Error {
    readonly code: PmemErrorCode;
    readonly recoverable: boolean;
    readonly details?: JsonObject;
    constructor(code: PmemErrorCode, message: string, options?: PmemErrorOptions);
}
export declare function recoverableDefault(code: PmemErrorCode): boolean;
export declare function toErrorPayload(error: unknown): ErrorPayload;
