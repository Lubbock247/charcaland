// Transferencias: un jugador manda monedas a otro con un motivo (p. ej. «Compro 3 panes»).
// Se pagan al momento y se manda un recibo verde por privado a los dos, al canal y por correo. Tabla en transferencias.sql.
import { reciboPng } from "./recibo.js";
import { mandarMensaje, canalDM, mandarCorreo } from "./mercadillo.js";

const VERDE = "#5ad16a";
const MAX_MONEDAS = 1_000_000_000;
const numero = id => "#" + String(id).padStart(4, "0");

// Lista de jugadores para elegir a quién mandar (sin saldo: eso solo lo ven los admins).
export async function jugadores(env, u) {
  const r = await env.DB.prepare("SELECT id, nombre, avatar FROM usuarios WHERE id <> ?1 AND id <> 'prueba' ORDER BY nombre COLLATE NOCASE").bind(u.id).all();
  return [200, r.results];
}

export async function transferir(env, u, d) {
  const a = String(d.a || ""), monedas = Number(d.monedas), motivo = String(d.motivo ?? "").trim().slice(0, 120);
  if (!a || a === u.id) return [400, { error: "Elige a otro jugador" }];
  if (!Number.isInteger(monedas) || monedas < 1 || monedas > MAX_MONEDAS) return [400, { error: "Pon una cantidad de monedas válida" }];
  if (!motivo) return [400, { error: "Falta el motivo" }];
  const otro = await env.DB.prepare("SELECT id, nombre FROM usuarios WHERE id = ?1").bind(a).first();
  if (!otro || otro.id === "prueba") return [404, { error: "Ese jugador no existe" }];
  const ahora = Date.now();
  // Todo o nada: si el saldo se queda en negativo, el trigger de la base de datos lo para.
  try {
    const r = await env.DB.batch([
      env.DB.prepare("UPDATE usuarios SET saldo = saldo - ?1 WHERE id = ?2").bind(monedas, u.id),
      env.DB.prepare("UPDATE usuarios SET saldo = saldo + ?1 WHERE id = ?2").bind(monedas, a),
      env.DB.prepare("INSERT INTO movimientos (usuario_id, cantidad, motivo, fecha) VALUES (?1,?2,?3,?4)").bind(u.id, -monedas, `Transferencia a ${otro.nombre}: ${motivo}`, ahora),
      env.DB.prepare("INSERT INTO movimientos (usuario_id, cantidad, motivo, fecha) VALUES (?1,?2,?3,?4)").bind(a, monedas, `Transferencia de ${u.nombre}: ${motivo}`, ahora),
      env.DB.prepare("INSERT INTO transferencias (de_id, a_id, monedas, motivo, fecha) VALUES (?1,?2,?3,?4,?5) RETURNING id").bind(u.id, a, monedas, motivo, ahora),
    ]);
    const saldo = (await env.DB.prepare("SELECT saldo FROM usuarios WHERE id = ?1").bind(u.id).first()).saldo;
    return [200, { ok: true, saldo, transferencia: r[4].results[0].id }];
  } catch (e) {
    if (String(e.message || e).includes("SALDO")) return [400, { error: "No tienes monedas suficientes" }];
    throw e;
  }
}

export function datosRecibo(t) {
  return { numero: t.id, tipo: "Transferencia", comprador: t.de || "?", vendedor: t.a || "?", fecha: t.fecha, color: VERDE,
    rotulos: { tipo: "TIPO", comprador: "PAGA", vendedor: "RECIBE" }, pie: ["Transferencias de Charcaland · Ghestec", "Pago entre jugadores."],
    objetos: [{ nombre: t.motivo, cantidad: 1, precio: t.monedas }] };
}

export async function enviarRecibo(env, id) {
  if (!env.DISCORD_BOT_TOKEN) return;
  const toma = await env.DB.prepare("UPDATE transferencias SET recibo_enviado = 1 WHERE id = ?1 AND recibo_enviado = 0").bind(id).run();
  if (!toma.meta.changes) return;
  let bien = 0;
  try {
    const t = await env.DB.prepare(`SELECT t.*, d.nombre AS de, d.correo AS de_correo, a.nombre AS a, a.correo AS a_correo FROM transferencias t
      LEFT JOIN usuarios d ON d.id = t.de_id LEFT JOIN usuarios a ON a.id = t.a_id WHERE t.id = ?1`).bind(id).first();
    const n = numero(t.id);
    const adj = [{ nombre: `transferencia-${String(t.id).padStart(4, "0")}.png`, tipo: "image/png", datos: await reciboPng(datosRecibo(t)) }];
    const paraQuienPaga = `🟢 Has mandado ${t.monedas} monedas a ${t.a}: «${t.motivo}». Recibo de transferencia ${n}.`;
    const paraQuienRecibe = `🟢 ${t.de} te ha mandado ${t.monedas} monedas: «${t.motivo}». Recibo de transferencia ${n}.`;
    const envios = [[() => canalDM(env, t.de_id), paraQuienPaga], [() => canalDM(env, t.a_id), paraQuienRecibe]];
    if (env.RECIBOS_CANAL) envios.push([async () => env.RECIBOS_CANAL, `🟢 Transferencia ${n}: ${t.de} → ${t.a}, ${t.monedas} monedas, «${t.motivo}».`]);
    for (const [canal, msg] of envios) {
      try { await mandarMensaje(env, await canal(), msg, adj); bien++; }
      catch (er) { console.error("Recibo de transferencia " + id, er.message); }
    }
    for (const [correo, msg] of [[t.de_correo, paraQuienPaga], [t.a_correo, paraQuienRecibe]]) {
      if (!correo) continue;
      try { await mandarCorreo(env, correo, `Recibo de transferencia ${n}`, msg.replace(/^🟢 /, ""), adj); bien++; }
      catch (er) { console.error("Correo de transferencia " + id, er.message); }
    }
  } catch (er) { console.error("Recibo de transferencia " + id, er.message); }
  // Si no salió ninguno, el Cron lo reintenta.
  if (!bien) await env.DB.prepare("UPDATE transferencias SET recibo_enviado = 0 WHERE id = ?1").bind(id).run();
}

export async function enviarPendientes(env) {
  const r = await env.DB.prepare("SELECT id FROM transferencias WHERE recibo_enviado = 0 ORDER BY id LIMIT 10").all();
  for (const x of r.results) await enviarRecibo(env, x.id);
}
