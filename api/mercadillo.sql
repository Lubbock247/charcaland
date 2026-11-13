-- Mercadillo: anuncios, pujas, ofertas de "Busco", movimientos de monedas y recibos.
-- Se aplica una vez: npx wrangler d1 execute charcaland --remote --file=mercadillo.sql  (o --local para probar)

CREATE TABLE IF NOT EXISTS anuncios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,                  -- 'vendo', 'busco' o 'subasta'
  autor_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  imagen TEXT,                         -- enlace a una imagen (opcional)
  descripcion TEXT NOT NULL DEFAULT '',
  objetos TEXT NOT NULL,               -- JSON: [{ nombre, cantidad, precio, encantamientos: [] }]
  precio INTEGER NOT NULL,             -- vendo/busco: total; subasta: precio de salida
  puja_minima INTEGER NOT NULL DEFAULT 1,
  fin INTEGER,                         -- subasta: fin en milisegundos (se alarga con la prórroga)
  puja INTEGER,                        -- subasta: puja más alta
  pujador_id TEXT,                     -- subasta: quién la tiene (sus monedas están apartadas)
  estado TEXT NOT NULL DEFAULT 'abierto', -- abierto, vendido, sin_venta, quitado
  comprador_id TEXT,
  version INTEGER NOT NULL DEFAULT 0,  -- cada cambio la sube en 1: si dos cambios chocan, uno falla
  creado INTEGER NOT NULL,
  cerrado INTEGER
);
CREATE INDEX IF NOT EXISTS anuncios_estado ON anuncios (estado, tipo);

CREATE TABLE IF NOT EXISTS pujas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anuncio_id INTEGER NOT NULL,
  usuario_id TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  fecha INTEGER NOT NULL
);

-- "Lo tengo" en un anuncio de Busco
CREATE TABLE IF NOT EXISTS ofertas (
  anuncio_id INTEGER NOT NULL,
  usuario_id TEXT NOT NULL,
  fecha INTEGER NOT NULL,
  PRIMARY KEY (anuncio_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id TEXT NOT NULL,
  cantidad INTEGER NOT NULL,           -- + entra, - sale
  motivo TEXT NOT NULL,
  anuncio_id INTEGER,
  admin_id TEXT,                       -- si lo hizo un administrador
  fecha INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS movimientos_usuario ON movimientos (usuario_id, id);

CREATE TABLE IF NOT EXISTS recibos (
  numero INTEGER PRIMARY KEY AUTOINCREMENT,
  anuncio_id INTEGER NOT NULL UNIQUE,
  tipo TEXT NOT NULL,
  comprador_id TEXT NOT NULL,
  vendedor_id TEXT NOT NULL,
  total INTEGER NOT NULL,
  objetos TEXT NOT NULL,               -- JSON tal como sale en el recibo
  fecha INTEGER NOT NULL,
  enviado INTEGER NOT NULL DEFAULT 0   -- para el bot (paso 4)
);

-- Nadie puede quedarse en negativo: si pasa, se cancela toda la operación.
CREATE TRIGGER IF NOT EXISTS saldo_no_negativo BEFORE UPDATE OF saldo ON usuarios
WHEN NEW.saldo < 0 BEGIN SELECT RAISE(ABORT, 'SALDO'); END;

-- Si el anuncio cambió desde que se leyó, se cancela toda la operación.
CREATE TRIGGER IF NOT EXISTS anuncio_version BEFORE UPDATE ON anuncios
WHEN NEW.version != OLD.version + 1 BEGIN SELECT RAISE(ABORT, 'CAMBIADO'); END;
