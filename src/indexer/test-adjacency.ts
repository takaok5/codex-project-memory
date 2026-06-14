import type { IndexedFileRecord, SymbolRecord, TestLinkRecord } from "../shared/types.js";

export function inferTestTargets(files: IndexedFileRecord[], symbols: SymbolRecord[]): TestLinkRecord[] {
  const links: TestLinkRecord[] = [];
  for (const file of files.filter((item) => item.isTest && item.id)) {
    const normalized = file.path.replace(/\.spec\.[^.]+$|\.test\.[^.]+$/, "");
    const candidates = symbols.filter((symbol) => {
      const targetFile = files.find((item) => item.id === symbol.fileId);
      return targetFile && normalized === targetFile.path.replace(/\.[^.]+$/, "") && symbol.kind !== "method";
    });
    for (const symbol of candidates) {
      links.push({ fileId: file.id!, targetSymbolId: symbol.id, testKind: "unit", summary: `Adjacent test for ${symbol.fqName}` });
    }
  }
  return links.sort((a, b) => (a.fileId - b.fileId) || ((a.targetSymbolId ?? 0) - (b.targetSymbolId ?? 0)));
}
