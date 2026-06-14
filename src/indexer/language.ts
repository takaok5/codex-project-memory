import type { LanguageKind } from "../shared/types.js";

export function classifyLanguage(filePath: string): LanguageKind | null {
  if (/\.(ts|tsx|mts|cts)$/.test(filePath)) {
    return "typescript";
  }
  if (/\.(js|jsx)$/.test(filePath)) {
    return "javascript";
  }
  return null;
}

export function isTestFile(filePath: string): boolean {
  const path = filePath.replaceAll("\\", "/");
  return /(^|\/)(test|tests|__tests__)\//.test(path) || /\.(spec|test)\.[cm]?[tj]sx?$/.test(path);
}

export function isGeneratedFile(filePath: string): boolean {
  const path = filePath.replaceAll("\\", "/").toLowerCase();
  return path.includes("/generated/") || path.endsWith(".generated.ts") || path.endsWith(".gen.ts") || path.endsWith(".d.ts");
}
