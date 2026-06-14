import { createHash } from "node:crypto";
import { PmemError } from "./errors.js";
import { writeFileAtomic } from "./fs.js";
export function safeJsonParse(text) {
    try {
        return { ok: true, value: JSON.parse(text) };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Invalid JSON." };
    }
}
export function stableStringify(value) {
    try {
        return JSON.stringify(canonicalize(value));
    }
    catch (error) {
        throw new PmemError("INTERNAL_ERROR", "Value cannot be serialized as JSON.", {
            details: { cause: error instanceof Error ? error.message : "unknown" }
        });
    }
}
export function writeJson(value) {
    try {
        return JSON.stringify(value);
    }
    catch (error) {
        throw new PmemError("INTERNAL_ERROR", "Value cannot be serialized as JSON.", {
            details: { cause: error instanceof Error ? error.message : "unknown" }
        });
    }
}
export function writeJsonFileAtomic(path, value) {
    const content = writeJson(value);
    writeFileAtomic(path, content);
}
export function canonicalJsonHash(value) {
    return `sha256:${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}
function canonicalize(value, seen = new WeakSet()) {
    if (value === null || typeof value !== "object") {
        return value;
    }
    if (seen.has(value)) {
        throw new TypeError("Circular reference in JSON value.");
    }
    seen.add(value);
    if (Array.isArray(value)) {
        const result = value.map((item) => canonicalize(item, seen));
        seen.delete(value);
        return result;
    }
    const record = value;
    const result = {};
    for (const key of Object.keys(record).sort()) {
        result[key] = canonicalize(record[key], seen);
    }
    seen.delete(value);
    return result;
}
//# sourceMappingURL=json.js.map