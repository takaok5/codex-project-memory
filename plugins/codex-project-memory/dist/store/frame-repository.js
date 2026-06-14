export function upsertFrame(db, frame) {
    db.prepare(`INSERT INTO frames(id, frame_type, title, svg_path, png_path, map_path, source_hash, generated_at)
     VALUES (@id, @frameType, @title, @svgPath, @pngPath, @mapPath, @sourceHash, @generatedAt)
     ON CONFLICT(id) DO UPDATE SET
       frame_type=excluded.frame_type,
       title=excluded.title,
       svg_path=excluded.svg_path,
       png_path=excluded.png_path,
       map_path=excluded.map_path,
       source_hash=excluded.source_hash,
       generated_at=excluded.generated_at`).run(frame);
}
export function getFrame(db, id) {
    const row = db.prepare("SELECT * FROM frames WHERE id = ?").get(id);
    return row ? fromRow(row) : null;
}
export function listFrames(db) {
    const order = ["current", "overview", "modules", "duplicates", "risks"];
    return db.prepare("SELECT * FROM frames").all().map(fromRow).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
function fromRow(row) {
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
//# sourceMappingURL=frame-repository.js.map