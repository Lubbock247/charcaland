CREATE TABLE IF NOT EXISTS noticias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,              -- 'evento' o 'update'
  titulo TEXT NOT NULL,
  fecha TEXT,                      -- AAAA-MM-DD; vacía = sin fecha (eventos planificados)
  etiqueta TEXT NOT NULL DEFAULT '',
  resumen TEXT NOT NULL DEFAULT '',
  texto TEXT NOT NULL DEFAULT '',
  cierre_votacion TEXT,
  votacion_cerrada INTEGER NOT NULL DEFAULT 0,
  autor_id TEXT,
  actualizado TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO noticias (tipo, titulo, fecha, etiqueta, texto) VALUES
  ('update', 'Nueva web del servidor', '2026-11-10', 'Web', 'Estrenamos esta página con noticias, eventos, lore y un buzón de sugerencias.'),
  ('update', 'Expansiones de Dominio (en pruebas)', '2026-11-01', 'Mod', 'Primer dominio disponible: Black Hand of Catastrophe. Pronto más.');
