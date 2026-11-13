-- Mercadillo, parte 2: imágenes subidas desde la web (antes eran enlaces).
-- npx wrangler d1 execute charcaland --remote --file=mercadillo2.sql
CREATE TABLE IF NOT EXISTS imagenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,          -- image/jpeg, image/png o image/webp
  datos BLOB NOT NULL,         -- ya reducida en el navegador (máx. ~500 KB)
  autor_id TEXT NOT NULL,
  creado INTEGER NOT NULL
);

-- Contador global para anuncios sin nombre («Anuncio 1», «Anuncio 2»…)
CREATE TABLE IF NOT EXISTS contadores (clave TEXT PRIMARY KEY, valor INTEGER NOT NULL);
INSERT OR IGNORE INTO contadores (clave, valor) VALUES ('anuncio_sin_nombre', 0);
