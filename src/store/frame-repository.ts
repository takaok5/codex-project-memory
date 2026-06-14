import type { FrameName, FrameRecord } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";

export function upsertFrame(db: MemoryDb, frame: FrameRecord): void {
  db.prepare(
    `INSERT INTO frames(id, frame_type, title, svg_path, png_path, map_path, source_hash, generated_at)
     VALUES (@id, @frameType, @title, @svgPath, @pngPath, @mapPath, @sourceHash, @generatedAt)
     ON CONFLICT(id) DO UPDATE SET
       frame_type=excluded.frame_type,
       title=excluded.title,
       svg_path=excluded.svg_path,
       png_path=excluded.png_path,
       map_path=excluded.map_path,
       source_hash=excluded.source_hash,
       generated_at=excluded.generated_at`
  ).run(frame);
}

export function getFrame(db: MemoryDb, id: FrameName): FrameRecord | null {
  const row = db.prepare("SELECT * FROM frames WHERE id = ?").get(id) as FrameRow | undefined;
  return row ? fromRow(row) : null;
}

export function listFrames(db: MemoryDb): FrameRecord[] {
  const order = ["current", "overview", "modules", "duplicates", "risks"];
  return (db.prepare("SELECT * FROM frames").all() as FrameRow[]).map(fromRow).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

interface FrameRow {
  id: FrameName;
  frame_type: FrameRecord["frameType"];
  title: string;
  svg_path: string;
  png_path: string | null;
  map_path: string;
  source_hash: string;
  generated_at: string;
}

function fromRow(row: FrameRow): FrameRecord {
  return {
    id: row.id,
    frameType: row.frame_type,
    title: row.title,
    svgPath: row.svg_path,
    pngPath: row.png_path,
    mapPath: row.map_path,
    sourceHash: row.source_hash,
    generatedAt: row.generated_at
  };
}
