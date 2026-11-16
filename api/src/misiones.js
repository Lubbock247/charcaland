// Misiones: personales (las ponen los admins a cada persona), globales (las crean los admins y
// las acepta una sola persona) y encargos (los crea cualquiera para que los haga otra persona).
// Estados: libre -> curso -> revisar -> hecha. También «rechazada» (personal que el jugador salta) y «borrada».
// Quien la tiene pulsa «Completado» (pasa a «revisar») y la aprueba un admin; un encargo, quien lo creó o un admin.
// Un encargo tiene dos precios: «completado» (mínimo) y «satisfactorio» (máximo). Al crearlo se aparta el máximo;
// al aprobarlo, quien lo creó elige cuál paga (si paga el mínimo se le devuelve la diferencia) y puede añadir dinero extra.
// Si se borra, se devuelve todo. Tablas en misiones.sql.
import { reciboPng } from "./recibo.js";
import { mandarMensaje, canalDM, mandarCorreo } from "./mercadillo.js";

const TIPOS = ["personal", "global", "encargo"];
export const LIMITES = { personales: 6, globales: 3, globales_dia: 3, encargos: 3, encargos_dia: 10 };
const MAX_MONEDAS = 1_000_000_000;
const MORADO = "#b79bff";

const entero = (v, min, max) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
const texto = (v, max) => String(v ?? "").trim().slice(0, max);
export const numeroMision = id => "#" + String(id).padStart(4, "0");

// 00:00 de hoy en hora de España, en milisegundos: ahí empieza el «día» de los límites.
export function inicioDia(ahora = Date.now()) {
  const partes = ms => Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const h = partes(ahora), medianoche = Date.UTC(+h.year, +h.month - 1, +h.day);
  const p = partes(medianoche);
  return medianoche - (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - medianoche);
}

// Lanza el lote (todo o nada) y traduce los errores de los triggers.
async function lote(env, sentencias) {
  try { await env.DB.batch(sentencias); return null; }
  catch (e) {
    const m = String(e.message || e);
    if (m.includes("SALDO")) return [400, { error: "No tienes monedas suficientes" }];
    if (m.includes("CAMBIADO")) return [409, { error: "La misión acaba de cambiar. Vuelve a cargar la página." }];
    throw e;
  }
}
const mov = (env, usuario, cantidad, motivo, admin, ahora) =>
  env.DB.prepare("INSERT INTO movimientos (usuario_id, cantidad, motivo, admin_id, fecha) VALUES (?1,?2,?3,?4,?5)")
    .bind(usuario, cantidad, motivo, admin ?? null, ahora);
const saldo = (env, usuario, cantidad) =>
  env.DB.prepare("UPDATE usuarios SET saldo = saldo + ?1 WHERE id = ?2").bind(cantidad, usuario);
// Cambia columnas de una misión subiendo su versión (si otro la cambió antes, el lote entero falla).
function cambiar(env, m, campos) {
  const k = Object.keys(campos);
  return env.DB.prepare(`UPDATE misiones SET ${k.map((c, i) => `${c} = ?${i + 1}`).join(", ")}, version = ?${k.length + 1} WHERE id = ?${k.length + 2}`)
    .bind(...k.map(c => campos[c]), m.version + 1, m.id);
}
const cuenta = async (env, sql, ...v) => (await env.DB.prepare(sql).bind(...v).first()).n;

// ---- Leer ----
const SELECT = `SELECT m.id, m.tipo, m.titulo, m.descripcion, m.monedas, m.monedas_min, m.objetos, m.estado, m.autor_id, m.de_admin, m.usuario_id, m.creado,
    a.nombre AS autor, a.avatar AS autor_avatar, p.nombre AS usuario, p.avatar AS usuario_avatar
  FROM misiones m LEFT JOIN usuarios a ON a.id = m.autor_id LEFT JOIN usuarios p ON p.id = m.usuario_id`;
// Solo los encargos dicen quién los creó; los del panel salen como «Administración».
function publica(m) {
  const r = { ...m, objetos: JSON.parse(m.objetos || "[]"), de_admin: !!m.de_admin };
  if (m.tipo !== "encargo" || m.de_admin) { r.autor_id = null; r.autor_avatar = null; r.autor = m.tipo === "encargo" ? "Administración" : null; }
  return r;
}

async function contadores(env, u) {
  const hoy = inicioDia();
  return {
    personales: await cuenta(env, "SELECT COUNT(*) AS n FROM misiones WHERE tipo = 'personal' AND usuario_id = ?1 AND estado IN ('curso','revisar')", u.id),
    globales: await cuenta(env, "SELECT COUNT(*) AS n FROM misiones WHERE tipo = 'global' AND usuario_id = ?1 AND estado = 'curso'", u.id),
    encargos: await cuenta(env, "SELECT COUNT(*) AS n FROM misiones WHERE tipo = 'encargo' AND usuario_id = ?1 AND estado IN ('curso','revisar')", u.id),
    globales_hoy: await cuenta(env, "SELECT COUNT(*) AS n FROM misiones_aceptadas WHERE usuario_id = ?1 AND fecha >= ?2", u.id, hoy),
    encargos_hoy: await cuenta(env, "SELECT COUNT(*) AS n FROM misiones WHERE tipo = 'encargo' AND de_admin = 0 AND autor_id = ?1 AND creado >= ?2", u.id, hoy),
  };
}

// Lo que ve cualquiera: globales y encargos abiertos (libres o ya cogidos) y, con sesión, sus personales.
export async function listar(env, u) {
  const r = await env.DB.prepare(`${SELECT} WHERE m.estado IN ('libre','curso','revisar')
    AND (m.tipo != 'personal' OR m.usuario_id = ?1) ORDER BY m.id DESC`).bind(u ? u.id : "").all();
  return { misiones: r.results.map(publica), limites: LIMITES, yo: u ? await contadores(env, u) : null };
}

// Solo admins: todas las misiones abiertas (también las personales de cada uno) y la lista de jugadores.
export async function listarAdmin(env, u) {
  if (u.rol !== "admin") return [403, { error: "Solo los administradores pueden hacer esto" }];
  const r = await env.DB.prepare(`${SELECT} WHERE m.estado IN ('libre','curso','revisar') ORDER BY m.id DESC`).all();
  const g = await env.DB.prepare("SELECT id, nombre, avatar FROM usuarios ORDER BY nombre COLLATE NOCASE").all();
  // Al admin sí se le dice qué admin creó cada cosa.
  return [200, { misiones: r.results.map(m => ({ ...publica(m), creador: m.autor })), usuarios: g.results, limites: LIMITES }];
}

async function leer(env, id) {
  const m = await env.DB.prepare("SELECT * FROM misiones WHERE id = ?1").bind(Number(id)).first();
  if (!m || !["libre", "curso", "revisar"].includes(m.estado)) return [null, [404, { error: "Esa misión ya no está disponible" }]];
  return [m, null];
}
const esAdmin = u => u.rol === "admin";
// Quién puede aprobar o devolver: un admin; en un encargo de un jugador, también quien lo creó.
const puedeRevisar = (u, m) => esAdmin(u) || (m.tipo === "encargo" && !m.de_admin && m.autor_id === u.id);

// ---- Crear ----
function leerObjetos(v) {
  const lista = Array.isArray(v) ? v : String(v ?? "").split("\n");
  return lista.map(o => texto(o, 60)).filter(Boolean).slice(0, 10);
}

export async function crear(env, u, d) {
  const tipo = TIPOS.includes(d.tipo) ? d.tipo : null;
  if (!tipo) return [400, { error: "Tipo de misión no válido" }];
  if (tipo !== "encargo" && !esAdmin(u)) return [403, { error: "Solo los administradores pueden crear misiones" }];
  const titulo = texto(d.titulo, 80), descripcion = texto(d.descripcion, 600);
  const monedas = entero(d.monedas || 0, 0, MAX_MONEDAS), objetos = leerObjetos(d.objetos);
  if (!titulo) return [400, { error: "Falta el título" }];
  if (monedas === null) return [400, { error: "Las monedas no son válidas" }];
  // Encargo: precio de «completado» (mínimo). Si no se pone, es el mismo que el de «satisfactorio».
  const vacio = d.monedas_min === undefined || d.monedas_min === null || d.monedas_min === "";
  const minimo = tipo !== "encargo" || vacio ? monedas : entero(d.monedas_min, 0, monedas);
  if (minimo === null) return [400, { error: "El precio de «completado» no puede ser mayor que el de «satisfactorio»" }];
  if (!monedas && !objetos.length) return [400, { error: "Pon una recompensa: monedas, objetos o las dos cosas" }];
  const ahora = Date.now();
  const insertar = (deAdmin, usuario, estado) => env.DB.prepare(
    "INSERT INTO misiones (tipo, titulo, descripcion, monedas, objetos, autor_id, de_admin, usuario_id, estado, aceptada, creado, monedas_min) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)"
  ).bind(tipo, titulo, descripcion, monedas, JSON.stringify(objetos), u.id, deAdmin, usuario, estado, usuario ? ahora : null, ahora, minimo);

  if (tipo === "personal") {
    const quien = String(d.usuario_id || "");
    if (!await env.DB.prepare("SELECT 1 FROM usuarios WHERE id = ?1").bind(quien).first()) return [404, { error: "No existe ese jugador" }];
    const n = await cuenta(env, "SELECT COUNT(*) AS n FROM misiones WHERE tipo = 'personal' AND usuario_id = ?1 AND estado IN ('curso','revisar')", quien);
    if (n >= LIMITES.personales) return [400, { error: `Ya tiene ${LIMITES.personales} misiones personales` }];
    await insertar(0, quien, "curso").run();
    return [201, { ok: true }];
  }
  if (tipo === "global") { await insertar(0, null, "libre").run(); return [201, { ok: true }]; }
  // Encargo desde Administración: no aparta monedas a nadie y no cuenta para el límite diario.
  if (esAdmin(u) && d.de_admin) { await insertar(1, null, "libre").run(); return [201, { ok: true }]; }
  const hoy = await cuenta(env, "SELECT COUNT(*) AS n FROM misiones WHERE tipo = 'encargo' AND de_admin = 0 AND autor_id = ?1 AND creado >= ?2", u.id, inicioDia(ahora));
  if (hoy >= LIMITES.encargos_dia) return [400, { error: `Hoy ya has creado ${LIMITES.encargos_dia} encargos. Mañana podrás crear más.` }];
  const s = [insertar(0, null, "libre")];
  if (monedas) s.push(saldo(env, u.id, -monedas), mov(env, u.id, -monedas, `Encargo apartado: «${titulo}»`, null, ahora));
  return (await lote(env, s)) || [201, { ok: true }];
}

// ---- Aceptar, completar y dejar ----
export async function aceptar(env, u, id) {
  const [m, err] = await leer(env, id);
  if (err) return err;
  if (m.tipo === "personal") return [400, { error: "Las misiones personales no se aceptan" }];
  if (m.estado !== "libre") return [400, { error: "Ya la ha aceptado otra persona" }];
  if (m.tipo === "encargo" && !m.de_admin && m.autor_id === u.id) return [400, { error: "Es tu propio encargo" }];
  const ahora = Date.now(), s = [cambiar(env, m, { estado: "curso", usuario_id: u.id, aceptada: ahora })];
  if (m.tipo === "encargo" && (await contadores(env, u)).encargos >= LIMITES.encargos)
    return [400, { error: `Ya tienes ${LIMITES.encargos} encargos aceptados. Termina o abandona uno antes.` }];
  if (m.tipo === "global") {
    const c = await contadores(env, u);
    if (c.globales >= LIMITES.globales) return [400, { error: `Ya tienes ${LIMITES.globales} misiones globales en curso` }];
    if (c.globales_hoy >= LIMITES.globales_dia) return [400, { error: `Hoy ya has aceptado ${LIMITES.globales_dia} misiones globales. Mañana podrás aceptar más.` }];
    s.push(env.DB.prepare("INSERT INTO misiones_aceptadas (mision_id, usuario_id, fecha) VALUES (?1,?2,?3)").bind(m.id, u.id, ahora));
  }
  return (await lote(env, s)) || [200, { ok: true }];
}

export async function completar(env, u, id) {
  const [m, err] = await leer(env, id);
  if (err) return err;
  if (m.usuario_id !== u.id) return [403, { error: "Esa misión no es tuya" }];
  if (m.estado !== "curso") return [400, { error: "Ya está pendiente de revisar" }];
  return (await lote(env, [cambiar(env, m, { estado: "revisar" })])) || [200, { ok: true }];
}

// Quien la tiene la deja: una personal desaparece (rechazada); una global o un encargo vuelven a quedar libres.
// Un admin puede liberar la global o el encargo de otra persona.
export async function abandonar(env, u, id) {
  const [m, err] = await leer(env, id);
  if (err) return err;
  if (!m.usuario_id || m.estado === "libre") return [400, { error: "Nadie tiene esa misión" }];
  const mia = m.usuario_id === u.id;
  if (!mia && !(esAdmin(u) && m.tipo !== "personal")) return [403, { error: "Esa misión no es tuya" }];
  const c = m.tipo === "personal" ? { estado: "rechazada", cerrado: Date.now() } : { estado: "libre", usuario_id: null, aceptada: null };
  return (await lote(env, [cambiar(env, m, c)])) || [200, { ok: true }];
}

// ---- Revisar: «No está hecha» y «Aprobar y pagar» ----
export async function devolver(env, u, id) {
  const [m, err] = await leer(env, id);
  if (err) return err;
  if (!puedeRevisar(u, m)) return [403, { error: "No puedes revisar esa misión" }];
  if (m.estado !== "revisar") return [400, { error: "Esa misión no está pendiente de revisar" }];
  return (await lote(env, [cambiar(env, m, { estado: "curso" })])) || [200, { ok: true }];
}

// Da la misión por hecha y paga las monedas. En las personales, las globales y los encargos de Administración
// las monedas se crean. En un encargo de un jugador el máximo ya estaba apartado de su saldo: se elige pagar
// «minimo» (completado; la diferencia vuelve a quien lo creó) o «satisfactorio» (el máximo), y quien lo creó
// puede añadir dinero extra, que sale de su saldo en ese momento.
export async function aprobar(env, u, id, d = {}) {
  const [m, err] = await leer(env, id);
  if (err) return err;
  if (!puedeRevisar(u, m)) return [403, { error: "No puedes revisar esa misión" }];
  if (!m.usuario_id || m.estado === "libre") return [400, { error: "Nadie tiene esa misión" }];
  const ahora = Date.now(), enc = m.tipo === "encargo", creador = enc && !m.de_admin && m.autor_id === u.id;
  const base = enc && d.pago === "minimo" ? m.monedas_min : m.monedas;
  const extra = d.extra ? entero(d.extra, 0, MAX_MONEDAS) : 0;
  if (extra === null) return [400, { error: "El dinero extra no es válido" }];
  if (extra && !creador) return [400, { error: "El dinero extra solo lo puede dar quien creó el encargo" }];
  const total = base + extra;
  const s = [cambiar(env, m, { estado: "hecha", cerrado: ahora, pagado: total, extra, recibo_enviado: enc ? 0 : null })];
  if (enc && !m.de_admin && base < m.monedas) s.push(saldo(env, m.autor_id, m.monedas - base),
    mov(env, m.autor_id, m.monedas - base, `Devolución: encargo «${m.titulo}» pagado como completado`, creador ? null : u.id, ahora));
  if (extra) s.push(saldo(env, u.id, -extra), mov(env, u.id, -extra, `Dinero extra: encargo «${m.titulo}»`, null, ahora));
  if (total) s.push(saldo(env, m.usuario_id, total),
    mov(env, m.usuario_id, total, `${enc ? "Encargo" : "Misión"} completad${enc ? "o" : "a"}: «${m.titulo}»`, esAdmin(u) && !creador ? u.id : null, ahora));
  return (await lote(env, s)) || [200, { ok: true, pagado: total, recibo_encargo: enc ? m.id : null }];
}

// Borrar: un admin, cualquiera; quien creó un encargo, el suyo mientras nadie lo haya aceptado.
// Si el encargo tenía monedas apartadas, se devuelven.
export async function borrar(env, u, id) {
  const [m, err] = await leer(env, id);
  if (err) return err;
  const mio = m.tipo === "encargo" && !m.de_admin && m.autor_id === u.id;
  if (!esAdmin(u) && !mio) return [403, { error: "No puedes borrar esa misión" }];
  if (!esAdmin(u) && m.estado !== "libre") return [400, { error: "Ya lo ha aceptado alguien: no se puede borrar. Pídeselo a un admin." }];
  const ahora = Date.now(), s = [cambiar(env, m, { estado: "borrada", cerrado: ahora })];
  if (m.tipo === "encargo" && !m.de_admin && m.monedas) s.push(saldo(env, m.autor_id, m.monedas),
    mov(env, m.autor_id, m.monedas, `Devolución: encargo «${m.titulo}» borrado`, mio ? null : u.id, ahora));
  return (await lote(env, s)) || [200, { ok: true }];
}

// ---- Recibo del encargo (morado) ----
// Se manda al aprobar el encargo, que es cuando se sabe cuánto se paga: por privado a quien lo creó y a quien
// lo hizo, al canal de registro (RECIBOS_CANAL) y por correo a quien tenga correo apuntado.
export function datosReciboEncargo(e) {
  const extra = e.extra || 0, base = (e.pagado ?? e.monedas) - extra;
  const nivel = e.monedas_min < e.monedas ? (base < e.monedas ? "Completado" : "Satisfactorio") : "";
  const objetos = [{ nombre: e.titulo, cantidad: 1, precio: base, encantamientos: JSON.parse(e.objetos || "[]").map(o => "Objeto: " + o) }];
  if (extra) objetos.push({ nombre: "Dinero extra", cantidad: 1, precio: extra });
  return { numero: e.id, tipo: "Encargo" + (nivel ? " · " + nivel : ""), comprador: e.de_admin ? "Administración" : e.autor || "?", vendedor: e.usuario || "?", fecha: e.cerrado,
    color: MORADO, rotulos: { tipo: "TIPO", comprador: "ENCARGA", vendedor: "LO HACE" },
    pie: ["Misiones de Charcaland · Ghestec", "Los objetos se entregan en el juego."], objetos };
}

export async function enviarReciboEncargo(env, id) {
  if (!env.DISCORD_BOT_TOKEN) return;
  // Se marca antes de enviar para que dos procesos no lo manden dos veces.
  const toma = await env.DB.prepare("UPDATE misiones SET recibo_enviado = 1, version = version + 1 WHERE id = ?1 AND recibo_enviado = 0").bind(id).run();
  if (!toma.meta.changes) return;
  let bien = 0;
  try {
    const e = await env.DB.prepare(`SELECT m.*, a.nombre AS autor, a.correo AS autor_correo, p.nombre AS usuario, p.correo AS usuario_correo FROM misiones m
      LEFT JOIN usuarios a ON a.id = m.autor_id LEFT JOIN usuarios p ON p.id = m.usuario_id WHERE m.id = ?1`).bind(id).first();
    const d = datosReciboEncargo(e), n = numeroMision(e.id);
    const premio = [e.pagado ? `${e.pagado} monedas` : "", JSON.parse(e.objetos || "[]").join(", ")].filter(Boolean).join(" + ");
    const adj = [{ nombre: `encargo-${String(e.id).padStart(4, "0")}.png`, tipo: "image/png", datos: await reciboPng(d) }];
    const paraCreador = `🟣 ${d.vendedor} ha hecho tu encargo «${e.titulo}»: has pagado ${premio}. Recibo de encargo ${n}.`;
    const paraQuienLoHizo = `🟣 Encargo «${e.titulo}» de ${d.comprador} aprobado: recibes ${premio}. Recibo de encargo ${n}.`;
    const envios = [[() => canalDM(env, e.usuario_id), paraQuienLoHizo]];
    if (!e.de_admin) envios.push([() => canalDM(env, e.autor_id), paraCreador]);
    if (env.RECIBOS_CANAL) envios.push([async () => env.RECIBOS_CANAL, `🟣 Encargo ${n}: ${d.comprador} → ${d.vendedor}, «${e.titulo}», ${premio}.`]);
    for (const [canal, msg] of envios) {
      try { await mandarMensaje(env, await canal(), msg, adj); bien++; }
      catch (er) { console.error("Recibo de encargo " + id, er.message); } // p. ej. alguien con los DM cerrados
    }
    for (const [correo, msg] of [[e.usuario_correo, paraQuienLoHizo], [e.de_admin ? null : e.autor_correo, paraCreador]]) {
      if (!correo) continue;
      try { await mandarCorreo(env, correo, `Recibo de encargo ${n}: ${e.titulo}`, msg.replace(/^🟣 /, ""), adj); bien++; }
      catch (er) { console.error("Correo de encargo " + id, er.message); }
    }
  } catch (er) { console.error("Recibo de encargo " + id, er.message); }
  // Si no salió ninguno, se deja para que el Cron lo reintente.
  if (!bien) await env.DB.prepare("UPDATE misiones SET recibo_enviado = 0, version = version + 1 WHERE id = ?1").bind(id).run();
}

export async function enviarPendientes(env) {
  const r = await env.DB.prepare("SELECT id FROM misiones WHERE recibo_enviado = 0 AND estado = 'hecha' ORDER BY id LIMIT 10").all();
  for (const x of r.results) await enviarReciboEncargo(env, x.id);
}
