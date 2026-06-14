import { canonicalJsonHash } from "../shared/json.js";
import type { NormalizedGraph } from "../shared/types.js";

export function computeGraphSourceHash(graph: NormalizedGraph): string {
  return canonicalJsonHash(graph);
}
