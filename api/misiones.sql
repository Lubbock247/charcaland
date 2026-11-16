-- Misiones: personales, globales y encargos.
-- Se aplica una vez: npx wrangler d1 execute charcaland --remote --file=misiones.sql  (o --local para probar)

CREATE TABLE IF NOT EXISTS misiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,                  -- 'personal', 'global' o 'encargo'
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  monedas INTEGER NOT NULL DEFAULT 0,  -- recompensa en monedas (se paga desde la web); en un encargo, el precio «satisfactorio» (el máximo, que se aparta)
  monedas_min INTEGER NOT NULL DEFAULT 0, -- encargo: precio «completado» (el mínimo); en las misiones es igual que monedas
  pagado INTEGER,                      -- lo que se pagó al aprobarla (con el dinero extra, si lo hubo)
  extra INTEGER NOT NULL DEFAULT 0,    -- encargo: dinero extra que añadió quien lo creó
  objetos TEXT NOT NULL DEFAULT '[]',  -- JSON: ["3× Diamante", ...] (se entregan en el juego)
  autor_id TEXT,                       -- quién la creó
  de_admin INTEGER NOT NULL DEFAULT 0, -- encargo creado desde Administración: sale como «Administración» y no aparta monedas a nadie
  usuario_id TEXT,                     -- personal: a quién se le puso; global y encargo: quién la aceptó
  estado TEXT NOT NULL DEFAULT 'libre',-- libre, curso, revisar, hecha, rechazada, borrada
  aceptada INTEGER,
  creado INTEGER NOT NULL,
  cerrado INTEGER,
  recibo_enviado INTEGER,              -- encargos hechos: 0 = recibo por mandar al canal, 1 = mandado
  version INTEGER NOT NULL DEFAULT 0   -- cada cambio la sube en 1: si dos cambios chocan, uno falla
);
CREATE INDEX IF NOT EXISTS misiones_estado ON misiones (estado, tipo);
CREATE INDEX IF NOT EXISTS misiones_usuario ON misiones (usuario_id, estado);

-- Cada vez que alguien acepta una misión global (para el límite de 3 al día, aunque luego la abandone).
CREATE TABLE IF NOT EXISTS misiones_aceptadas (
  mision_id INTEGER NOT NULL,
  usuario_id TEXT NOT NULL,
  fecha INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS misiones_aceptadas_usuario ON misiones_aceptadas (usuario_id, fecha);

-- Si la misión cambió desde que se leyó, se cancela toda la operación (nadie cobra dos veces).
CREATE TRIGGER IF NOT EXISTS mision_version BEFORE UPDATE ON misiones
WHEN NEW.version != OLD.version + 1 BEGIN SELECT RAISE(ABORT, 'CAMBIADO'); END;
