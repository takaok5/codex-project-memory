import { statSync } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { PmemError } from "../shared/errors.js";
import { normalizePathSeparators } from "../shared/path.js";
import type { ProjectMemoryConfig, ScannedFile } from "../shared/types.js";
import { hashFile } from "./hash.js";
import { classifyLanguage, getLanguageMetadata, isGeneratedFile, isLanguageEnabled, isTestFile } from "./language.js";

export async function scanProjectFiles(root: string, config: ProjectMemoryConfig): Promise<ScannedFile[]> {
  try {
    const exclude = Array.from(new Set([...config.scan.exclude, ".codex/memory/**"]));
    const paths = await fg(config.scan.include, {
      cwd: root,
      ignore: exclude,
      onlyFiles: true,
      dot: true,
      unique: true
    });
    return paths
      .map((filePath) => normalizePathSeparators(filePath))
      .sort()
      .map((filePath) => {
        const absPath = path.join(root, filePath);
        const stat = statSync(absPath);
        const language = classifyLanguage(filePath);
        const metadata = language ? getLanguageMetadata(language) : null;
        return {
          path: filePath,
          absPath,
          language,
          displayName: metadata?.displayName ?? null,
          sizeBytes: stat.size,
          hash: hashFile(absPath),
          isTest: isTestFile(filePath),
          isGenerated: isGeneratedFile(filePath)
        };
      })
      .filter((file) => isLanguageEnabled(file.language, config));
  } catch (error) {
    throw new PmemError("FS_ERROR", "Failed to scan project files.", {
      details: { cause: error instanceof Error ? error.message : "unknown" }
    });
  }
}
