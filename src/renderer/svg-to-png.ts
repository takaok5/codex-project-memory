import { writeFileAtomic } from "../shared/fs.js";
import type { PngExportResult } from "../shared/types.js";

export async function exportSvgToPng(svg: string, targetPath: string, enabled: boolean): Promise<PngExportResult> {
  if (!enabled) {
    return { ok: false, warning: "png_export_failed: png export disabled" };
  }
  try {
    const sharpModule = await import("sharp");
    const sharp = sharpModule.default;
    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
    writeFileAtomic(targetPath, buffer);
    return { ok: true, path: targetPath };
  } catch (error) {
    return { ok: false, warning: `png_export_failed: ${error instanceof Error ? error.message : "sharp unavailable"}` };
  }
}
