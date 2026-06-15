CREATE TABLE IF NOT EXISTS project_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT,
  summary TEXT,
  owns_json TEXT NOT NULL DEFAULT '[]',
  must_not_json TEXT NOT NULL DEFAULT '[]',
  dependencies_json TEXT NOT NULL DEFAULT '[]',
  risk_level TEXT NOT NULL DEFAULT 'normal' CHECK (risk_level IN ('normal', 'high')),
  updated_at TEXT NOT NULL,
  CHECK (root_path IS NULL OR root_path NOT LIKE '/%'),
  CHECK (root_path IS NULL OR root_path NOT LIKE '%\%')
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  language TEXT,
  module_id TEXT REFERENCES modules(id) ON UPDATE CASCADE ON DELETE SET NULL,
  hash TEXT NOT NULL CHECK (length(hash) > 0),
  size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  line_count INTEGER NOT NULL DEFAULT 0 CHECK (line_count >= 0),
  is_test INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0, 1)),
  is_generated INTEGER NOT NULL DEFAULT 0 CHECK (is_generated IN (0, 1)),
  last_indexed_at TEXT NOT NULL,
  analysis_json TEXT NOT NULL DEFAULT '{}',
  CHECK (path NOT LIKE '/%'),
  CHECK (path NOT LIKE '%\%')
);

CREATE TABLE IF NOT EXISTS language_capabilities (
  language TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('deep', 'structural', 'fallback')),
  parser TEXT NOT NULL,
  symbols INTEGER NOT NULL CHECK (symbols IN (0, 1)),
  dependencies INTEGER NOT NULL CHECK (dependencies IN (0, 1)),
  tests INTEGER NOT NULL CHECK (tests IN (0, 1)),
  routes INTEGER NOT NULL CHECK (routes IN (0, 1)),
  diagnostics INTEGER NOT NULL CHECK (diagnostics IN (0, 1)),
  tool TEXT,
  tool_status TEXT NOT NULL CHECK (tool_status IN ('available', 'missing', 'installing', 'failed', 'disabled', 'unsupported')),
  degraded_reason TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS diagnostics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  file_path TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
  code TEXT,
  message TEXT NOT NULL,
  start_line INTEGER CHECK (start_line IS NULL OR start_line >= 1),
  end_line INTEGER CHECK (end_line IS NULL OR end_line >= 1),
  source TEXT NOT NULL CHECK (source IN ('compiler', 'lsp', 'tool', 'fallback')),
  tool TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(file_path, tool, fingerprint),
  CHECK (file_path NOT LIKE '/%'),
  CHECK (file_path NOT LIKE '%\%'),
  CHECK (end_line IS NULL OR start_line IS NULL OR end_line >= start_line)
);

CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  fq_name TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  exported INTEGER NOT NULL DEFAULT 0 CHECK (exported IN (0, 1)),
  start_line INTEGER CHECK (start_line IS NULL OR start_line >= 1),
  end_line INTEGER CHECK (end_line IS NULL OR end_line >= 1),
  signature TEXT,
  signature_hash TEXT,
  body_hash TEXT,
  summary TEXT,
  UNIQUE(file_id, fq_name, kind),
  CHECK (end_line IS NULL OR start_line IS NULL OR end_line >= start_line)
);

CREATE TABLE IF NOT EXISTS symbol_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  from_symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  to_symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  edge_kind TEXT NOT NULL CHECK (edge_kind IN ('import', 'export', 'dependency')),
  confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  UNIQUE(source_file_id, from_symbol_id, to_symbol_id, edge_kind)
);

CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  handler_symbol_id INTEGER REFERENCES symbols(id) ON DELETE SET NULL,
  module_id TEXT REFERENCES modules(id) ON UPDATE CASCADE ON DELETE SET NULL,
  UNIQUE(file_id, method, path),
  CHECK (path NOT LIKE '%\%')
);

CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  target_symbol_id INTEGER REFERENCES symbols(id) ON DELETE SET NULL,
  test_kind TEXT NOT NULL DEFAULT 'unknown' CHECK (test_kind IN ('unit', 'integration', 'e2e', 'unknown')),
  summary TEXT
);

CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  warning_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  module_id TEXT REFERENCES modules(id) ON UPDATE CASCADE ON DELETE SET NULL,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  symbol_id INTEGER REFERENCES symbols(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  recommendation TEXT,
  source TEXT NOT NULL DEFAULT 'inferred' CHECK (source IN ('parser', 'indexer', 'renderer', 'agent', 'mcp', 'config', 'inferred', 'diagnostic')),
  confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS duplicate_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  left_symbol_id INTEGER REFERENCES symbols(id) ON DELETE CASCADE,
  right_symbol_id INTEGER REFERENCES symbols(id) ON DELETE CASCADE,
  left_file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  right_file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  similarity REAL NOT NULL CHECK (similarity >= 0.0 AND similarity <= 1.0),
  reason TEXT,
  created_at TEXT NOT NULL,
  CHECK (left_symbol_id IS NOT NULL OR left_file_id IS NOT NULL),
  CHECK (right_symbol_id IS NOT NULL OR right_file_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS frames (
  id TEXT PRIMARY KEY CHECK (id IN ('current', 'overview', 'modules', 'duplicates', 'risks')),
  frame_type TEXT NOT NULL CHECK (frame_type IN ('current', 'overview', 'module_map', 'duplicate_map', 'risk_map')),
  title TEXT NOT NULL,
  svg_path TEXT NOT NULL,
  png_path TEXT,
  map_path TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  CHECK (svg_path NOT LIKE '/%'),
  CHECK (svg_path NOT LIKE '%\%'),
  CHECK (map_path NOT LIKE '/%'),
  CHECK (map_path NOT LIKE '%\%'),
  CHECK (png_path IS NULL OR png_path NOT LIKE '/%'),
  CHECK (png_path IS NULL OR png_path NOT LIKE '%\%')
);

CREATE TABLE IF NOT EXISTS retrieval_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intent TEXT NOT NULL,
  agent TEXT NOT NULL CHECK (agent IN ('retrieval', 'duplicate', 'drift', 'architecture', 'render')),
  output_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_module_id ON files(module_id);
CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);
CREATE INDEX IF NOT EXISTS idx_files_language ON files(language);
CREATE INDEX IF NOT EXISTS idx_language_capabilities_tier ON language_capabilities(tier);
CREATE INDEX IF NOT EXISTS idx_diagnostics_file_id ON diagnostics(file_id);
CREATE INDEX IF NOT EXISTS idx_diagnostics_language ON diagnostics(language);
CREATE INDEX IF NOT EXISTS idx_diagnostics_severity ON diagnostics(severity);
CREATE INDEX IF NOT EXISTS idx_diagnostics_tool ON diagnostics(tool);
CREATE INDEX IF NOT EXISTS idx_symbols_file_id ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_fq_name ON symbols(fq_name);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
CREATE INDEX IF NOT EXISTS idx_symbol_edges_source_file_id ON symbol_edges(source_file_id);
CREATE INDEX IF NOT EXISTS idx_symbol_edges_from_symbol_id ON symbol_edges(from_symbol_id);
CREATE INDEX IF NOT EXISTS idx_symbol_edges_to_symbol_id ON symbol_edges(to_symbol_id);
CREATE INDEX IF NOT EXISTS idx_symbol_edges_kind ON symbol_edges(edge_kind);
CREATE INDEX IF NOT EXISTS idx_routes_file_id ON routes(file_id);
CREATE INDEX IF NOT EXISTS idx_routes_module_id ON routes(module_id);
CREATE INDEX IF NOT EXISTS idx_routes_method_path ON routes(method, path);
CREATE INDEX IF NOT EXISTS idx_tests_file_id ON tests(file_id);
CREATE INDEX IF NOT EXISTS idx_tests_target_symbol_id ON tests(target_symbol_id);
CREATE INDEX IF NOT EXISTS idx_warnings_active ON warnings(resolved_at, severity, created_at);
CREATE INDEX IF NOT EXISTS idx_warnings_file_source ON warnings(file_id, source, resolved_at);
CREATE INDEX IF NOT EXISTS idx_warnings_type ON warnings(warning_type);
CREATE INDEX IF NOT EXISTS idx_warnings_module_id ON warnings(module_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_warnings_active_file_dedupe
  ON warnings(file_id, source, fingerprint)
  WHERE file_id IS NOT NULL AND resolved_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_warnings_active_global_dedupe
  ON warnings(source, fingerprint)
  WHERE file_id IS NULL AND resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_similarity ON duplicate_candidates(similarity DESC);
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_kind ON duplicate_candidates(kind);
CREATE INDEX IF NOT EXISTS idx_frames_generated_at ON frames(generated_at);
CREATE INDEX IF NOT EXISTS idx_retrieval_logs_created_at ON retrieval_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_retrieval_logs_agent ON retrieval_logs(agent);
