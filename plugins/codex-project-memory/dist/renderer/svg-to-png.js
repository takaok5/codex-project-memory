import { writeFileAtomic } from "../shared/fs.js";
export async function exportSvgToPng(svg, targetPath, enabled) {
    if (!enabled) {
        return { ok: false, warning: "png_export_failed: png export disabled" };
    }
    try {
        const sharpModule = await import("sharp");
        const sharp = sharpModule.default;
        const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
        writeFileAtomic(targetPath, buffer);
        return { ok: true, path: targetPath };
    }
    catch (error) {
        return { ok: false, warning: `png_export_failed: ${error instanceof Error ? error.message : "sharp unavailable"}` };
    }
}
//# sourceMappingURL=svg-to-png.js.map