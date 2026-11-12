CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  avatar TEXT,
  saldo INTEGER NOT NULL DEFAULT 0,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS paginas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seccion TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL DEFAULT '',
  padre_id INTEGER,
  orden INTEGER NOT NULL DEFAULT 0,
  autor_id TEXT,
  actualizado TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (seccion, slug)
);

ALTER TABLE paginas ADD COLUMN icono TEXT;

ALTER TABLE usuarios ADD COLUMN en_servidor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN revisado TEXT;

CREATE TABLE IF NOT EXISTS noticias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,              -- 'evento' o 'update'
  titulo TEXT NOT NULL,
  fecha TEXT,                      -- AAAA-MM-DD; vacía = sin fecha (eventos planificados)
  etiqueta TEXT NOT NULL DEFAULT '',
  texto TEXT NOT NULL DEFAULT '',
  cierre_votacion TEXT,
  votacion_cerrada INTEGER NOT NULL DEFAULT 0,
  autor_id TEXT,
  actualizado TEXT NOT NULL DEFAULT (datetime('now'))
);
