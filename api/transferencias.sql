-- Transferencias de monedas entre jugadores (pagos de cosas hechas en el juego).
CREATE TABLE IF NOT EXISTS transferencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  de_id TEXT NOT NULL,
  a_id TEXT NOT NULL,
  monedas INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  fecha INTEGER NOT NULL,
  recibo_enviado INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS transferencias_recibo ON transferencias (recibo_enviado, id);
