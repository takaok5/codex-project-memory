import { inspect } from "node:util";
import type { ErrorPayload, JsonObject, JsonValue, PmemErrorCode } from "./types.js";

const RECOVERABLE_DEFAULTS: Record<PmemErrorCode, boolean> = {
  INVALID_INPUT: true,
  VALIDATION_ERROR: true,
  NOT_INITIALIZED: true,
  ALREADY_EXISTS: true,
  CONFIG_ERROR: true,
  FS_ERROR: true,
  DB_ERROR: false,
  INDEX_ERROR: true,
  RENDER_ERROR: true,
  AGENT_ERROR: true,
  MCP_ERROR: true,
  SAFETY_ERROR: false,
  STATE_ERROR: true,
  FRAME_NOT_FOUND: true,
  TEMPLATE_ERROR: true,
  INTERNAL_ERROR: false
};

export interface PmemErrorOptions {
  details?: JsonObject;
  recoverable?: boolean;
}

export class PmemError extends Error {
  readonly code: PmemErrorCode;
  readonly recoverable: boolean;
  readonly details?: JsonObject;

  constructor(code: PmemErrorCode, message: string, options: PmemErrorOptions = {}) {
    super(message.trim() || defaultMessage(code));
    this.name = "PmemError";
    this.code = code;
    this.recoverable = options.recoverable ?? RECOVERABLE_DEFAULTS[code];
    this.details = options.details;
  }
}

export function recoverableDefault(code: PmemErrorCode): boolean {
  return RECOVERABLE_DEFAULTS[code];
}

export function toErrorPayload(error: unknown): ErrorPayload {
  if (error instanceof PmemError) {
    return compactPayload({
      code: error.code,
      message: error.message,
      recoverable: error.recoverable,
      details: sanitizeDetails(error.details)
    });
  }

  if (error instanceof Error) {
    return compactPayload({
      code: "INTERNAL_ERROR",
      message: sanitizeMessage(error.message || "Unexpected error."),
      recoverable: RECOVERABLE_DEFAULTS.INTERNAL_ERROR
    });
  }

  if (typeof error === "string") {
    return compactPayload({
      code: "INTERNAL_ERROR",
      message: sanitizeMessage(error),
      recoverable: RECOVERABLE_DEFAULTS.INTERNAL_ERROR
    });
  }

  return compactPayload({
    code: "INTERNAL_ERROR",
    message: sanitizeMessage(inspect(error, { depth: 1, breakLength: 120 })),
    recoverable: RECOVERABLE_DEFAULTS.INTERNAL_ERROR
  });
}

function defaultMessage(code: PmemErrorCode): string {
  switch (code) {
    case "NOT_INITIALIZED":
      return "Project memory is not initialized. Run pmem init.";
    case "FRAME_NOT_FOUND":
      return "Requested memory frame was not found.";
    case "CONFIG_ERROR":
      return "Project memory config is invalid.";
    case "DB_ERROR":
      return "Project memory database error.";
    case "SAFETY_ERROR":
      return "Path safety check failed.";
    default:
      return code.replaceAll("_", " ").toLowerCase();
  }
}

function compactPayload(payload: ErrorPayload): ErrorPayload {
  const message = sanitizeMessage(payload.message || defaultMessage(payload.code));
  const details = sanitizeDetails(payload.details);
  if (details) {
    return {
      code: payload.code,
      message,
      recoverable: payload.recoverable,
      details
    };
  }

  return {
    code: payload.code,
    message,
    recoverable: payload.recoverable
  };
}

function sanitizeMessage(message: string): string {
  const oneLine = message.replace(/\s+/g, " ").trim() || "Unexpected error.";
  return redactAbsolutePath(oneLine).slice(0, 300);
}

function sanitizeDetails(details: JsonObject | undefined): JsonObject | undefined {
  if (!details) {
    return undefined;
  }

  const sanitized = sanitizeJsonValue(details);
  if (isJsonObject(sanitized) && Object.keys(sanitized).length > 0) {
    return sanitized;
  }

  return undefined;
}

function sanitizeJsonValue(value: JsonValue): JsonValue {
  if (typeof value === "string") {
    return redactAbsolutePath(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item));
  }

  if (isJsonObject(value)) {
    const result: JsonObject = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = sanitizeJsonValue(nested);
    }
    return result;
  }

  return value;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactAbsolutePath(value: string): string {
  return value
    .replace(/[A-Za-z]:[\\/][^\s"',}]+/g, "[redacted-path]")
    .replace(/(^|[\s"',:])\/(?:Users|home|tmp|var|etc|opt|srv|root|mnt)\/[^\s"',}]+/g, "$1[redacted-path]");
}
