import { toErrorPayload } from "../shared/errors.js";
export function toMcpToolError(error) {
    return { error: toErrorPayload(error) };
}
//# sourceMappingURL=errors.js.map