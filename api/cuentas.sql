-- Cuenta sin Discord (temporal) para un admin: entra con su enlace, correo y contraseña; recibos por correo.
-- npx wrangler d1 execute charcaland --remote --file=cuentas.sql
CREATE TABLE IF NOT EXISTS cuentas_locales (
  usuario_id TEXT PRIMARY KEY,   -- el mismo id que su cuenta de Discord
  login TEXT NOT NULL UNIQUE,    -- su correo
  hash TEXT NOT NULL,            -- contraseña resumida (PBKDF2), nunca la contraseña
  sal TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sesiones (
  token TEXT PRIMARY KEY,        -- resumido (SHA-256)
  usuario_id TEXT NOT NULL,
  creado INTEGER NOT NULL,
  caduca INTEGER NOT NULL
);
ALTER TABLE usuarios ADD COLUMN correo TEXT;   -- a quien tiene correo le llegan los recibos por correo
