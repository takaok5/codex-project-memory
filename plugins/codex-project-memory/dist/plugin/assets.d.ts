import type { PluginAssetPaths } from "../shared/types.js";
export declare const PLACEHOLDER_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
export declare function ensureAssetPlaceholders(paths: PluginAssetPaths, options?: {
    force?: boolean;
}): void;
