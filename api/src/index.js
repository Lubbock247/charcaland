// API de Charcaland: cuentas con Discord, roles y saldo.
import { reciboPng } from "./recibo.js";
import * as merc from "./mercadillo.js";
import { revisarClear } from "./comandos.js";
import * as cuentas from "./cuentas.js";
// Cada petición lleva el token de Discord del usuario; aquí se comprueba
// con Discord que es válido y que se creó para ESTA aplicación.

function cors(env, req) {
  const origen = req.headers.get("Origin") || "";
  const permitidos = env.ORIGENES.split(",");
  return {
    "Access-Control-Allow-Origin": permitidos.includes(origen) ? origen : permitidos[0],
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Como",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}

const json = (datos, estado, cab) =>
  new Response(JSON.stringify(datos), { status: estado || 200, headers: { "Content-Type": "application/json", ...cab } });

// Solo para probar en local: con PRUEBAS_LOCAL=1 en .dev.vars (nunca se sube) y la API en 127.0.0.1,
// la cabecera X-Prueba-Usuario hace de usuario sin pasar por Discord.
const esLocal = (req, env) => env.PRUEBAS_LOCAL === "1" && new URL(req.url).hostname === "127.0.0.1";

async function usuarioDe(req, env) {
  const prueba = esLocal(req, env) && req.headers.get("X-Prueba-Usuario");
  if (prueba) {
    await env.DB.prepare("INSERT INTO usuarios (id, nombre) VALUES (?1, ?1) ON CONFLICT(id) DO NOTHING").bind(prueba).run();
    const f = await env.DB.prepare("SELECT id, nombre, avatar, saldo FROM usuarios WHERE id = ?1").bind(prueba).first();
    return { ...f, rol: prueba.startsWith("admin") ? "admin" : "usuario" };
  }
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  // Cuenta sin Discord (token «cl_…»): mismos datos y mismo rol que su cuenta de Discord.
  if (auth.startsWith("Bearer cl_")) {
    const f = await cuentas.usuarioLocal(env, auth.slice(7));
    if (!f) return null;
    const admins = await cuentas.listaAdmins(env);
    return { ...f, rol: admins.includes(f.id) ? "admin" : "usuario", sin_discord: true };
  }
  const r = await fetch("https://discord.com/api/oauth2/@me", { headers: { Authorization: auth } });
  if (!r.ok) return null;
  const d = await r.json();
  if (!d.application || d.application.id !== env.DISCORD_CLIENT_ID || !d.user) return null;
  const u = d.user;
  const nombre = u.global_name || u.username;
  await env.DB.prepare(
    "INSERT INTO usuarios (id, nombre, avatar) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET nombre = ?2, avatar = ?3"
  ).bind(u.id, nombre, u.avatar).run();
  const fila = await env.DB.prepare("SELECT id, nombre, avatar, saldo, en_servidor, revisado FROM usuarios WHERE id = ?1").bind(u.id).first();
  const admins = await cuentas.listaAdmins(env); // con el cambio de id del admin que conectó Discord
  const { en_servidor, revisado, ...datos } = fila;
  const res = { ...datos, rol: admins.includes(u.id) ? "admin" : "usuario" };
  // Requisito: estar en el servidor de Discord. Sesiones antiguas sin el permiso "guilds" deben volver a entrar.
  if (!(d.scopes || []).includes("guilds")) return { ...res, fuera: "permiso" };
  const reciente = revisado && Date.now() - Date.parse(revisado + "Z") < 10 * 60 * 1000;
  if (en_servidor && reciente) return res;
  const g = await fetch("https://discord.com/api/users/@me/guilds", { headers: { Authorization: auth } });
  if (!g.ok) return en_servidor ? res : { ...res, fuera: "servidor" }; // si Discord falla, se respeta lo último sabido
  const dentro = (await g.json()).some(s => s.id === env.DISCORD_GUILD_ID);
  await env.DB.prepare("UPDATE usuarios SET en_servidor = ?1, revisado = datetime('now') WHERE id = ?2").bind(dentro ? 1 : 0, u.id).run();
  return dentro ? res : { ...res, fuera: "servidor" };
}

// Igual que usuarioDe, pero devuelve una respuesta de error si no vale para hacer cosas.
// Modo pruebas: un admin con la cabecera «X-Como: prueba» actúa como el «Jugador de prueba»,
// para poder comprar, vender y pujar sin esperar a otra persona. Empieza con 10.000 monedas.
async function comoPrueba(req, env, u) {
  if (!u || u.fuera || u.rol !== "admin" || req.headers.get("X-Como") !== "prueba") return u;
  await env.DB.prepare("INSERT INTO usuarios (id, nombre, saldo, en_servidor) VALUES ('prueba', 'Jugador de prueba', 10000, 1) ON CONFLICT(id) DO NOTHING").run();
  const f = await env.DB.prepare("SELECT id, nombre, avatar, saldo FROM usuarios WHERE id = 'prueba'").first();
  return { ...f, rol: "usuario", prueba: true, admin_real: u.id };
}

async function miembroDe(req, env, cab) {
  const u = await comoPrueba(req, env, await usuarioDe(req, env));
  if (!u) return [null, json({ error: "No has iniciado sesión" }, 401, cab)];
  if (u.fuera) return [null, json({ error: "Tienes que estar en el Discord del servidor", fuera: u.fuera }, 403, cab)];
  return [u, null];
}

// ---- Wikis (Mods y Lore) ----
const SECCIONES = ["mods", "lore"];
const CATEGORIAS_LORE = ["mundo", "habilidades", "personajes", "relaciones"];
const CATEGORIAS_PROPIAS = ["personajes", "relaciones"]; // las crea y edita cada jugador

// Si una página cambia de título, los enlaces [[Título viejo]] de las demás pasan al nuevo
const normal = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
async function seguirEnlaces(env, seccion, viejo, nuevo) {
  const r = await env.DB.prepare("SELECT id, contenido FROM paginas WHERE seccion = ?1 AND contenido LIKE '%[[%'").bind(seccion).all();
  const cambios = [];
  for (const p of r.results) {
    const c = p.contenido.replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, (todo, nombre, resto) =>
      normal(nombre) === normal(viejo) ? `[[${nuevo}${resto || ""}]]` : todo);
    if (c !== p.contenido) cambios.push(env.DB.prepare("UPDATE paginas SET contenido = ?1 WHERE id = ?2").bind(c, p.id));
  }
  if (cambios.length) await env.DB.batch(cambios);
}

function slugDe(t) {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "pagina";
}
// Quién puede crear/editar/borrar una página
function puede(u, seccion, categoria, pagina) {
  if (!u) return false;
  if (u.rol === "admin") return true;
  if (seccion === "lore" && CATEGORIAS_PROPIAS.includes(categoria)) return !pagina || pagina.autor_id === u.id;
  return false;
}

async function wikiListar(env, seccion) {
  const r = await env.DB.prepare(
    `SELECT p.id, p.seccion, p.categoria, p.slug, p.titulo, p.padre_id, p.orden, p.autor_id, p.icono, length(p.contenido) AS largo, u.nombre AS autor
     FROM paginas p LEFT JOIN usuarios u ON u.id = p.autor_id WHERE p.seccion = ?1 ORDER BY p.orden, p.titulo`
  ).bind(seccion).all();
  return r.results;
}
async function wikiLeer(env, seccion, slug) {
  return env.DB.prepare(
    `SELECT p.*, u.nombre AS autor FROM paginas p LEFT JOIN usuarios u ON u.id = p.autor_id
     WHERE p.seccion = ?1 AND p.slug = ?2`
  ).bind(seccion, slug).first();
}
async function wikiGuardar(env, u, d) {
  const titulo = String(d.titulo || "").trim().slice(0, 80);
  const contenido = String(d.contenido || "").replace(/\r\n?/g, "\n").slice(0, 20000);
  if (!titulo) return [400, { error: "Falta el título" }];
  let existente = null;
  if (d.id) {
    existente = await env.DB.prepare("SELECT * FROM paginas WHERE id = ?1").bind(Number(d.id)).first();
    if (!existente) return [404, { error: "No existe esa página" }];
  }
  const seccion = existente ? existente.seccion : d.seccion;
  let categoria = existente ? existente.categoria : String(d.categoria || "");
  if (!SECCIONES.includes(seccion)) return [400, { error: "Sección no válida" }];
  if (seccion === "lore" && !CATEGORIAS_LORE.includes(categoria)) return [400, { error: "Categoría no válida" }];
  if (seccion === "mods") categoria = "";
  if (!puede(u, seccion, categoria, existente)) return [403, { error: "No tienes permiso" }];
  const esAdmin = u.rol === "admin";
  let padre = existente ? existente.padre_id : null;
  if (esAdmin && "padre_id" in d) padre = d.padre_id ? Number(d.padre_id) : null;
  if (existente && padre === existente.id) padre = null;
  // La página de arriba debe existir y no puede estar dentro de esta misma (evita círculos)
  for (let id = padre, pasos = 0; id !== null; pasos++) {
    const p = await env.DB.prepare("SELECT seccion, padre_id FROM paginas WHERE id = ?1").bind(id).first();
    if (!p || p.seccion !== seccion || pasos > 20) return [400, { error: "La página de arriba no es válida" }];
    if (existente && id === existente.id) return [400, { error: "No se puede meter una página dentro de sí misma" }];
    id = p.padre_id;
  }
  const orden = esAdmin && Number.isFinite(Number(d.orden)) ? Number(d.orden) : (existente ? existente.orden : 0);
  const icono = esAdmin && typeof d.icono === "string" && /^[a-z0-9-]{1,40}$/.test(d.icono)
    ? d.icono : (existente ? existente.icono : null);
  if (existente) {
    await env.DB.prepare(
      "UPDATE paginas SET titulo = ?1, contenido = ?2, padre_id = ?3, orden = ?4, icono = ?5, actualizado = datetime('now') WHERE id = ?6"
    ).bind(titulo, contenido, padre, orden, icono, existente.id).run();
    if (titulo !== existente.titulo) await seguirEnlaces(env, seccion, existente.titulo, titulo);
    return [200, { slug: existente.slug }];
  }
  let slug = slugDe(titulo), n = 1;
  while (await env.DB.prepare("SELECT 1 FROM paginas WHERE seccion = ?1 AND slug = ?2").bind(seccion, slug).first()) {
    n++; slug = slugDe(titulo) + "-" + n;
  }
  await env.DB.prepare(
    "INSERT INTO paginas (seccion, categoria, slug, titulo, contenido, padre_id, orden, autor_id, icono) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)"
  ).bind(seccion, categoria, slug, titulo, contenido, padre, orden, u.id, icono).run();
  return [201, { slug }];
}
async function wikiBorrar(env, u, id) {
  const p = await env.DB.prepare("SELECT * FROM paginas WHERE id = ?1").bind(Number(id)).first();
  if (!p) return [404, { error: "No existe esa página" }];
  if (!puede(u, p.seccion, p.categoria, p)) return [403, { error: "No tienes permiso" }];
  if (await env.DB.prepare("SELECT 1 FROM paginas WHERE padre_id = ?1").bind(p.id).first())
    return [400, { error: "Tiene páginas dentro. Bórralas o muévelas antes." }];
  await env.DB.prepare("DELETE FROM paginas WHERE id = ?1").bind(p.id).run();
  return [200, { ok: true }];
}

// ---- Noticias (eventos y updates). Solo los administradores crean, editan y borran. ----
const TIPOS_NOTICIA = { eventos: "evento", updates: "update" };
const fechaValida = f => /^\d{4}-\d{2}-\d{2}$/.test(f) && !isNaN(Date.parse(f));

const hoyMadrid = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

async function noticiasListar(env, tipo, u) {
  const r = await env.DB.prepare(
    "SELECT id, tipo, titulo, fecha, etiqueta, resumen, texto, multiple, anonima, en_inicio, hora_inicio, hora_fin FROM noticias WHERE tipo = ?1 ORDER BY fecha IS NULL, fecha DESC, id DESC"
  ).bind(tipo).all();
  const lista = r.results;
  if (tipo !== "evento" || !lista.length) return lista;
  const ops = (await env.DB.prepare(
    "SELECT o.id, o.noticia_id, o.texto FROM opciones o JOIN noticias n ON n.id = o.noticia_id WHERE n.tipo = 'evento' ORDER BY o.orden, o.id"
  ).all()).results;
  const votos = (await env.DB.prepare(
    "SELECT v.noticia_id, v.opcion_id, v.usuario_id, us.nombre, us.avatar FROM votos v LEFT JOIN usuarios us ON us.id = v.usuario_id ORDER BY v.rowid"
  ).all()).results;
  const admin = u && u.rol === "admin";
  for (const n of lista) {
    // Quién votó: visible para todos si no es anónima; en las anónimas, solo para los administradores.
    const verNombres = !n.anonima || admin;
    const persona = v => ({ id: v.usuario_id, nombre: v.nombre || "?", avatar: v.avatar });
    n.opciones = ops.filter(o => o.noticia_id === n.id).map(o => {
      const vs = votos.filter(v => v.opcion_id === o.id);
      return { id: o.id, texto: o.texto, votos: vs.length,
        // fotos de los 3 últimos (en las anónimas, a quien no es admin no se le dice quién)
        ultimos: vs.slice(-3).reverse().map(v => n.anonima ? {} : { id: v.usuario_id, avatar: v.avatar }),
        ...(verNombres ? { votantes: vs.slice().reverse().map(persona) } : {}) };
    });
    n.votantes = new Set(votos.filter(v => v.noticia_id === n.id).map(v => v.usuario_id)).size;
    n.ver_votos = verNombres;
    n.mis_votos = u ? votos.filter(v => v.noticia_id === n.id && v.usuario_id === u.id).map(v => v.opcion_id) : [];
  }
  return lista;
}

// Las opciones se cambian conservando los votos de las que siguen igual.
async function guardarOpciones(env, id, textos) {
  const viejas = (await env.DB.prepare("SELECT id, texto FROM opciones WHERE noticia_id = ?1").bind(id).all()).results;
  const cambios = [];
  for (const o of viejas) if (!textos.includes(o.texto)) {
    cambios.push(env.DB.prepare("DELETE FROM votos WHERE opcion_id = ?1").bind(o.id));
    cambios.push(env.DB.prepare("DELETE FROM opciones WHERE id = ?1").bind(o.id));
  }
  textos.forEach((t, i) => {
    const v = viejas.find(o => o.texto === t);
    cambios.push(v ? env.DB.prepare("UPDATE opciones SET orden = ?1 WHERE id = ?2").bind(i, v.id)
                   : env.DB.prepare("INSERT INTO opciones (noticia_id, texto, orden) VALUES (?1, ?2, ?3)").bind(id, t, i));
  });
  if (cambios.length) await env.DB.batch(cambios);
}

// Pulsar una opción: si ya la tenías votada, se quita; si no, se vota
// (en las de una sola respuesta, sustituye al voto anterior).
async function votar(env, u, d) {
  const n = await env.DB.prepare("SELECT id, fecha, multiple FROM noticias WHERE id = ?1 AND tipo = 'evento'").bind(Number(d.noticia_id)).first();
  if (!n) return [404, { error: "No existe" }];
  if (n.fecha && n.fecha < hoyMadrid()) return [400, { error: "El evento ya pasó: no se puede votar" }];
  const o = await env.DB.prepare("SELECT id FROM opciones WHERE id = ?1 AND noticia_id = ?2").bind(Number(d.opcion_id), n.id).first();
  if (!o) return [400, { error: "Opción no válida" }];
  const ya = await env.DB.prepare("SELECT 1 FROM votos WHERE noticia_id = ?1 AND usuario_id = ?2 AND opcion_id = ?3").bind(n.id, u.id, o.id).first();
  if (ya) {
    await env.DB.prepare("DELETE FROM votos WHERE noticia_id = ?1 AND usuario_id = ?2 AND opcion_id = ?3").bind(n.id, u.id, o.id).run();
    return [200, { ok: true }];
  }
  const cambios = [];
  if (!n.multiple) cambios.push(env.DB.prepare("DELETE FROM votos WHERE noticia_id = ?1 AND usuario_id = ?2").bind(n.id, u.id));
  cambios.push(env.DB.prepare("INSERT INTO votos (noticia_id, usuario_id, opcion_id) VALUES (?1, ?2, ?3)").bind(n.id, u.id, o.id));
  await env.DB.batch(cambios);
  return [200, { ok: true }];
}

// ---- Eventos del servidor de Discord (reflejo de los eventos con fecha de la web) ----
// Necesita el secreto DISCORD_BOT_TOKEN (bot en el servidor con permiso de gestionar eventos).
const horaValida = h => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
// "2026-12-06" + "18:00" en hora de España -> instante ISO (UTC)
function madridAISO(fecha, hora) {
  const [Y, M, D] = fecha.split("-").map(Number), [h, m] = hora.split(":").map(Number);
  const guess = Date.UTC(Y, M - 1, D, h, m);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(guess)).map(x => [x.type, x.value]));
  const comoMadrid = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess - (comoMadrid - guess)).toISOString();
}

async function discordApi(env, metodo, ruta, cuerpo) {
  const r = await fetch("https://discord.com/api/v10" + ruta, {
    method: metodo,
    headers: { Authorization: "Bot " + env.DISCORD_BOT_TOKEN, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (r.status === 404 && metodo !== "POST") return { borrado: true };
  if (!r.ok) throw new Error("Discord " + r.status + ": " + (await r.text()).slice(0, 200));
  return r.status === 204 ? {} : r.json();
}

// Deja el evento de Discord igual que el de la web. Devuelve un aviso si algo falla (sin impedir guardar).
async function sincronizarDiscord(env, id) {
  if (!env.DISCORD_BOT_TOKEN) return null;
  const n = await env.DB.prepare("SELECT * FROM noticias WHERE id = ?1 AND tipo = 'evento'").bind(id).first();
  if (!n) return null;
  const base = `/guilds/${env.DISCORD_GUILD_ID}/scheduled-events`;
  try {
    const debeEstar = n.fecha && n.fecha >= hoyMadrid();
    if (!debeEstar) {
      if (n.discord_id) {
        await discordApi(env, "DELETE", `${base}/${n.discord_id}`);
        await env.DB.prepare("UPDATE noticias SET discord_id = NULL WHERE id = ?1").bind(id).run();
      }
      return null;
    }
    const ini = madridAISO(n.fecha, n.hora_inicio || "18:00");
    let fin = madridAISO(n.fecha, n.hora_fin || "20:00");
    if (fin <= ini) fin = new Date(Date.parse(fin) + 86400000).toISOString(); // termina al día siguiente
    const datos = {
      name: n.titulo.slice(0, 100),
      description: `${n.resumen}\n\n${env.WEB_URL}eventos.html#${n.id}`.slice(0, 1000),
      scheduled_start_time: ini, scheduled_end_time: fin,
      privacy_level: 2, entity_type: 3, entity_metadata: { location: "Servidor de Minecraft" },
    };
    let ev = n.discord_id ? await discordApi(env, "PATCH", `${base}/${n.discord_id}`, datos) : null;
    if (!ev || ev.borrado) ev = await discordApi(env, "POST", base, datos); // no existía o lo borraron a mano
    if (ev.id !== n.discord_id) await env.DB.prepare("UPDATE noticias SET discord_id = ?1 WHERE id = ?2").bind(ev.id, id).run();
    return null;
  } catch (e) {
    return "Guardado en la web, pero no se pudo actualizar en Discord (" + e.message + ")";
  }
}

async function noticiaGuardar(env, u, d) {
  if (u.rol !== "admin") return [403, { error: "Solo los administradores pueden hacer esto" }];
  const tipo = d.tipo === "evento" ? "evento" : d.tipo === "update" ? "update" : null;
  if (!tipo) return [400, { error: "Tipo no válido" }];
  const titulo = String(d.titulo || "").trim().slice(0, 120);
  if (!titulo) return [400, { error: "Falta el título" }];
  const fecha = String(d.fecha || "").trim();
  if (fecha && !fechaValida(fecha)) return [400, { error: "Fecha no válida" }];
  if (!fecha && tipo === "update") return [400, { error: "Falta la fecha" }];
  const etiqueta = tipo === "update" ? String(d.etiqueta || "").trim().slice(0, 30) : "";
  const texto = String(d.texto || "").trim().slice(0, 4000);
  const resumen = String(d.resumen || "").trim().slice(0, 300);
  if (!resumen) return [400, { error: "Falta el texto de vista previa" }];
  if (tipo === "update" && !/^\d+\.\d+\.\d+$/.test(etiqueta)) return [400, { error: "La versión debe ser como 1.0.0" }];
  const opciones = tipo === "evento" && Array.isArray(d.opciones)
    ? [...new Set(d.opciones.map(t => String(t).trim().slice(0, 80)).filter(Boolean))].slice(0, 12) : [];
  if (opciones.length === 1) return [400, { error: "Una votación necesita al menos 2 opciones" }];
  const ev = tipo === "evento";
  const horaIni = ev && fecha && horaValida(d.hora_inicio || "") ? d.hora_inicio : null;
  const horaFin = ev && fecha && horaValida(d.hora_fin || "") ? d.hora_fin : null;
  const multiple = ev && d.multiple ? 1 : 0, anonima = ev && d.anonima ? 1 : 0, enInicio = ev && !fecha && d.en_inicio ? 1 : 0;
  if (d.id) {
    const r = await env.DB.prepare(
      "UPDATE noticias SET titulo = ?1, fecha = ?2, etiqueta = ?3, texto = ?4, autor_id = ?5, resumen = ?8, multiple = ?9, anonima = ?10, en_inicio = ?11, actualizado = datetime('now') WHERE id = ?6 AND tipo = ?7"
    ).bind(titulo, fecha || null, etiqueta, texto, u.id, Number(d.id), tipo, resumen, multiple, anonima, enInicio).run();
    if (!r.meta.changes) return [404, { error: "No existe" }];
    await env.DB.prepare("UPDATE noticias SET hora_inicio = ?1, hora_fin = ?2 WHERE id = ?3").bind(horaIni, horaFin, Number(d.id)).run();
    if (ev) await guardarOpciones(env, Number(d.id), opciones);
    const aviso = ev ? await sincronizarDiscord(env, Number(d.id)) : null;
    return [200, { id: Number(d.id), aviso }];
  }
  const r = await env.DB.prepare(
    "INSERT INTO noticias (tipo, titulo, fecha, etiqueta, texto, autor_id, resumen, multiple, anonima, en_inicio) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
  ).bind(tipo, titulo, fecha || null, etiqueta, texto, u.id, resumen, multiple, anonima, enInicio).run();
  const id = r.meta.last_row_id;
  await env.DB.prepare("UPDATE noticias SET hora_inicio = ?1, hora_fin = ?2 WHERE id = ?3").bind(horaIni, horaFin, id).run();
  if (opciones.length) await guardarOpciones(env, id, opciones);
  const aviso = ev ? await sincronizarDiscord(env, id) : null;
  return [200, { id, aviso }];
}

async function noticiaBorrar(env, u, id) {
  if (u.rol !== "admin") return [403, { error: "Solo los administradores pueden hacer esto" }];
  const vieja = await env.DB.prepare("SELECT discord_id FROM noticias WHERE id = ?1").bind(Number(id)).first();
  if (vieja && vieja.discord_id && env.DISCORD_BOT_TOKEN) {
    try { await discordApi(env, "DELETE", `/guilds/${env.DISCORD_GUILD_ID}/scheduled-events/${vieja.discord_id}`); } catch {}
  }
  const [, , r] = await env.DB.batch([
    env.DB.prepare("DELETE FROM votos WHERE noticia_id = ?1").bind(Number(id)),
    env.DB.prepare("DELETE FROM opciones WHERE noticia_id = ?1").bind(Number(id)),
    env.DB.prepare("DELETE FROM noticias WHERE id = ?1").bind(Number(id)),
  ]);
  return r.meta.changes ? [200, { ok: true }] : [404, { error: "No existe" }];
}

// Sugerencias: el webhook de Discord es un secreto del Worker (WEBHOOK_SUGERENCIAS),
// nunca llega a la web. El nombre lo pone la API con la sesión de Discord, no el navegador.
const ultimaSugerencia = new Map(); // id de usuario -> hora del último envío (por instancia)
async function enviarSugerencia(env, u, d) {
  if (!env.WEBHOOK_SUGERENCIAS) return [503, { error: "El buzón aún no está conectado" }];
  const texto = String(d.texto || "").trim().slice(0, 1500);
  const tipo = String(d.tipo || "Otro").trim().slice(0, 40);
  if (!texto) return [400, { error: "La sugerencia está vacía" }];
  const ahora = Date.now();
  if (ahora - (ultimaSugerencia.get(u.id) || 0) < 30000) return [429, { error: "Espera un poco antes de mandar otra" }];
  ultimaSugerencia.set(u.id, ahora);
  const p = Object.fromEntries(new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date(ahora)).map(x => [x.type, x.value]));
  const contenido = `${u.nombre} sobre ${tipo}:\n${texto}\nFecha - ${p.day}/${p.month}/${p.year}`;
  const r = await fetch(env.WEBHOOK_SUGERENCIAS, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "oompa-lompa", content: contenido, allowed_mentions: { parse: [] } }),
  });
  return r.ok ? [200, { ok: true }] : [502, { error: "Discord no aceptó el mensaje" }];
}

export default {
  async fetch(req, env, ctx) {
    const cab = cors(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cab });
    const ruta = new URL(req.url).pathname;
    const local = esLocal(req, env) && req.headers.get("X-Prueba-Usuario");
    try {
      // Foto de prueba del recibo: solo en local (wrangler dev).
      if (ruta === "/api/recibo-prueba" && new URL(req.url).hostname === "127.0.0.1") {
        const tipo = new URL(req.url).searchParams.get("tipo") || "Compra";
        if (tipo === "Subasta") return new Response(await reciboPng({ numero: 3, tipo, comprador: "Steve", vendedor: "Alex", fecha: Date.now(), objetos: [
          { nombre: "Lote de libros", cantidad: 1, precio: 70, encantamientos: ["2× Libro encantado (Reparación)", "1× Libro encantado (Afilado V)"] }] }),
          { headers: { "Content-Type": "image/png" } });
        const png = await reciboPng({ numero: 1, tipo, comprador: "Steve", vendedor: "Alex", fecha: Date.now(), objetos: [
          { nombre: "Pico de diamante", cantidad: 1, precio: 150, encantamientos: ["Eficiencia V", "Irrompibilidad III", "Fortuna III"] },
          { nombre: "Manzana dorada", cantidad: 8, precio: 12 },
          { nombre: "Libro encantado", cantidad: 2, precio: 75, encantamientos: ["Reparación"] }] });
        return new Response(png, { headers: { "Content-Type": "image/png" } });
      }
      // Cuenta sin Discord: estado del enlace, entrar, salir y conectar con Discord.
      const cu = ruta.match(/^\/api\/cuenta\/(enlace|entrar|salir|conectar)$/);
      if (cu && req.method === "POST") {
        const d = await req.json().catch(() => ({}));
        const auth = req.headers.get("Authorization") || "";
        const local = auth.startsWith("Bearer cl_") ? auth.slice(7) : null;
        const [est, cuerpo] =
          cu[1] === "enlace" ? await cuentas.estadoEnlace(env, d.codigo) :
          cu[1] === "entrar" ? await cuentas.entrar(env, d) :
          cu[1] === "salir" ? (local ? await cuentas.salir(env, local) : [200, { ok: true }]) :
          local ? await cuentas.conectarDiscord(env, local, String(d.discord || ""),
            esLocal(req, env) && d.prueba ? { application: { id: env.DISCORD_CLIENT_ID }, user: d.prueba } : null)
          : [401, { error: "No has entrado con tu enlace" }];
        return json(cuerpo, est, cab);
      }
      if (ruta === "/api/yo" && req.method === "GET") {
        const u = await comoPrueba(req, env, await usuarioDe(req, env));
        return u ? json(u, 200, cab) : json({ error: "No has iniciado sesión" }, 401, cab);
      }
      const m = ruta.match(/^\/api\/wiki\/(mods|lore)(?:\/([a-z0-9-]+))?$/);
      if (m && req.method === "GET") {
        if (!m[2]) return json(await wikiListar(env, m[1]), 200, cab);
        const p = await wikiLeer(env, m[1], m[2]);
        return p ? json(p, 200, cab) : json({ error: "No existe esa página" }, 404, cab);
      }
      if (ruta === "/api/wiki" && req.method === "POST") {
        const [u, error] = await miembroDe(req, env, cab);
        if (error) return error;
        const [est, cuerpo] = await wikiGuardar(env, u, await req.json());
        return json(cuerpo, est, cab);
      }
      const b = ruta.match(/^\/api\/wiki\/(\d+)$/);
      if (b && req.method === "DELETE") {
        const [u, error] = await miembroDe(req, env, cab);
        if (error) return error;
        const [est, cuerpo] = await wikiBorrar(env, u, b[1]);
        return json(cuerpo, est, cab);
      }
      const n = ruta.match(/^\/api\/noticias\/(eventos|updates)$/);
      if (n && req.method === "GET") {
        const u = req.headers.get("Authorization") ? await usuarioDe(req, env) : null;
        return json(await noticiasListar(env, TIPOS_NOTICIA[n[1]], u && !u.fuera ? u : null), 200, cab);
      }
      if (ruta === "/api/votar" && req.method === "POST") {
        const [u, error] = await miembroDe(req, env, cab);
        if (error) return error;
        const [est, cuerpo] = await votar(env, u, await req.json());
        return json(cuerpo, est, cab);
      }
      if (ruta === "/api/noticias" && req.method === "POST") {
        const [u, error] = await miembroDe(req, env, cab);
        if (error) return error;
        const [est, cuerpo] = await noticiaGuardar(env, u, await req.json());
        return json(cuerpo, est, cab);
      }
      const nb = ruta.match(/^\/api\/noticias\/(\d+)$/);
      if (nb && req.method === "DELETE") {
        const [u, error] = await miembroDe(req, env, cab);
        if (error) return error;
        const [est, cuerpo] = await noticiaBorrar(env, u, nb[1]);
        return json(cuerpo, est, cab);
      }
      if (ruta === "/api/sugerencia" && req.method === "POST") {
        const [u, error] = await miembroDe(req, env, cab);
        if (error) return error;
        const [est, cuerpo] = await enviarSugerencia(env, u, await req.json());
        return json(cuerpo, est, cab);
      }
      // ---- Mercadillo ----
      const im = ruta.match(/^\/api\/imagen\/(\d+)$/);
      if (im && req.method === "GET") {
        const f = await merc.leerImagen(env, im[1]);
        if (!f) return json({ error: "No existe" }, 404, cab);
        return new Response(f.datos, { headers: { "Content-Type": f.tipo, "Cache-Control": "public, max-age=31536000, immutable", ...cab } });
      }
      if (ruta === "/api/mercadillo" && req.method === "GET") {
        const u = req.headers.get("Authorization") || local ? await usuarioDe(req, env) : null;
        const yo = await comoPrueba(req, env, u);
        return json(await merc.listar(env, yo && !yo.fuera ? yo : null), 200, cab);
      }
      const mc = ruta.match(/^\/api\/mercadillo(?:\/(\d+)(?:\/(comprar|pujar|lotengo|aceptar))?)?$/);
      const otras = ["/api/movimientos", "/api/monedas", "/api/usuarios"].includes(ruta) || /^\/api\/recibo\/\d+\.png$/.test(ruta);
      if (mc || otras) {
        const [u, error] = await miembroDe(req, env, cab);
        if (error) return error;
        const cuerpo = () => req.method === "POST" ? req.json().catch(() => ({})) : {};
        let res = null;
        if (mc && !mc[1] && req.method === "POST") res = await merc.crear(env, u, await cuerpo());
        else if (mc && mc[1] && !mc[2] && req.method === "DELETE") res = await merc.quitar(env, u, mc[1]);
        else if (mc && mc[1] && !mc[2] && req.method === "POST") res = await merc.editar(env, u, mc[1], await cuerpo());
        else if (mc && mc[2] === "comprar" && req.method === "POST") res = await merc.comprar(env, u, mc[1]);
        else if (mc && mc[2] === "lotengo" && req.method === "POST") res = await merc.loTengo(env, u, mc[1]);
        else if (mc && mc[2] === "aceptar" && req.method === "POST") res = await merc.aceptar(env, u, mc[1], await cuerpo());
        else if (mc && mc[2] === "pujar" && req.method === "POST") res = await merc.pujar(env, u, mc[1], await cuerpo());
        else if (ruta === "/api/movimientos" && req.method === "GET") res = await merc.movimientos(env, u, new URL(req.url));
        else if (ruta === "/api/monedas" && req.method === "POST") res = await merc.darMonedas(env, u, await cuerpo());
        else if (ruta === "/api/usuarios" && req.method === "GET") res = await merc.usuarios(env, u);
        else if (ruta.startsWith("/api/recibo/") && req.method === "GET") {
          const png = await merc.imagenRecibo(env, u, ruta.match(/\d+/)[0]);
          if (png === null) return json({ error: "No existe ese recibo" }, 404, cab);
          if (png === false) return json({ error: "Ese recibo no es tuyo" }, 403, cab);
          return new Response(png, { headers: { "Content-Type": "image/png", ...cab } });
        }
        // Tras una compra, el recibo se manda por Discord sin hacer esperar al comprador.
        if (res && res[1].recibo) ctx.waitUntil(merc.enviarRecibo(env, res[1].recibo));
        if (res) return json(res[1], res[0], cab);
      }
      return json({ error: "No existe" }, 404, cab);
    } catch (e) {
      console.error(e);
      return json({ error: "Error del servidor" }, 500, cab);
    }
  },
  // Cron Trigger (cada minuto): cierra las subastas que han terminado.
  async scheduled(evento, env, ctx) {
    // Cierra subastas y manda los recibos pendientes (los de subastas y los que fallaron).
    ctx.waitUntil(merc.cerrarSubastas(env).then(() => merc.enviarPendientes(env)));
    ctx.waitUntil(revisarClear(env)); // «/clear» de los admins en el privado con el bot
  },
};
