-- Pestañas del Lore (Mundo, Personajes...). Las crean, renombran y borran los admins.
-- propias = 1: cada jugador crea y edita sus páginas; 0: solo los admins.
CREATE TABLE IF NOT EXISTS lore_categorias (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  propias INTEGER NOT NULL DEFAULT 0,
  orden INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO lore_categorias (id, nombre, propias, orden) VALUES
  ('mundo', 'Mundo', 0, 0),
  ('personajes', 'Personajes', 1, 1),
  ('relaciones', 'Relaciones', 1, 2);
