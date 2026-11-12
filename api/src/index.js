// API de Charcaland: cuentas con Discord, roles y saldo.
// Cada petición lleva el token de Discord del usuario; aquí se comprueba
// con Discord que es válido y que se creó para ESTA aplicación.

function cors(env, req) {
  const origen = req.headers.get("Origin") || "";
  const permitidos = env.ORIGENES.split(",");
  return {
    "Access-Control-Allow-Origin": permitidos.includes(origen) ? origen : permitidos[0],
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}

const json = (datos, estado, cab) =>
  new Response(JSON.stringify(datos), { status: estado || 200, headers: { "Content-Type": "application/json", ...cab } });

async function usuarioDe(req, env) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
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
  const admins = env.ADMIN_IDS.split(",").map(s => s.trim()).filter(Boolean);
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
async function miembroDe(req, env, cab) {
  const u = await usuarioDe(req, env);
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

async function noticiasListar(env, tipo) {
  const r = await env.DB.prepare(
    "SELECT id, tipo, titulo, fecha, etiqueta, resumen, texto, cierre_votacion, votacion_cerrada FROM noticias WHERE tipo = ?1 ORDER BY fecha IS NULL, fecha DESC, id DESC"
  ).bind(tipo).all();
  return r.results;
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
  const etiqueta = String(d.etiqueta || "").trim().slice(0, 30);
  const texto = String(d.texto || "").trim().slice(0, 4000);
  const resumen = String(d.resumen || "").trim().slice(0, 300);
  if (!resumen) return [400, { error: "Falta el resumen" }];
  if (d.id) {
    const r = await env.DB.prepare(
      "UPDATE noticias SET titulo = ?1, fecha = ?2, etiqueta = ?3, texto = ?4, autor_id = ?5, resumen = ?8, actualizado = datetime('now') WHERE id = ?6 AND tipo = ?7"
    ).bind(titulo, fecha || null, etiqueta, texto, u.id, Number(d.id), tipo, resumen).run();
    if (!r.meta.changes) return [404, { error: "No existe" }];
    return [200, { id: Number(d.id) }];
  }
  const r = await env.DB.prepare(
    "INSERT INTO noticias (tipo, titulo, fecha, etiqueta, texto, autor_id, resumen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
  ).bind(tipo, titulo, fecha || null, etiqueta, texto, u.id, resumen).run();
  return [200, { id: r.meta.last_row_id }];
}

async function noticiaBorrar(env, u, id) {
  if (u.rol !== "admin") return [403, { error: "Solo los administradores pueden hacer esto" }];
  const r = await env.DB.prepare("DELETE FROM noticias WHERE id = ?1").bind(Number(id)).run();
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
  async fetch(req, env) {
    const cab = cors(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cab });
    const ruta = new URL(req.url).pathname;
    try {
      if (ruta === "/api/yo" && req.method === "GET") {
        const u = await usuarioDe(req, env);
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
      if (n && req.method === "GET") return json(await noticiasListar(env, TIPOS_NOTICIA[n[1]]), 200, cab);
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
      return json({ error: "No existe" }, 404, cab);
    } catch (e) {
      return json({ error: "Error del servidor" }, 500, cab);
    }
  },
};
