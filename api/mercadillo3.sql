-- Bot: estado guardado (por ejemplo, el último mensaje leído del privado de cada admin para «/clear»).
-- npx wrangler d1 execute charcaland --remote --file=mercadillo3.sql
CREATE TABLE IF NOT EXISTS bot_estado (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
