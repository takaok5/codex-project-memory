import { canonicalJsonHash } from "../shared/json.js";
export function computeGraphSourceHash(graph) {
    return canonicalJsonHash(graph);
}
//# sourceMappingURL=hash.js.map