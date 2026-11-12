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
  const fila = await env.DB.prepare("SELECT id, nombre, avatar, saldo FROM usuarios WHERE id = ?1").bind(u.id).first();
  const admins = env.ADMIN_IDS.split(",").map(s => s.trim()).filter(Boolean);
  return { ...fila, rol: admins.includes(u.id) ? "admin" : "usuario" };
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
        const u = await usuarioDe(req, env);
        if (!u) return json({ error: "No has iniciado sesión" }, 401, cab);
        const [est, cuerpo] = await wikiGuardar(env, u, await req.json());
        return json(cuerpo, est, cab);
      }
      const b = ruta.match(/^\/api\/wiki\/(\d+)$/);
      if (b && req.method === "DELETE") {
        const u = await usuarioDe(req, env);
        if (!u) return json({ error: "No has iniciado sesión" }, 401, cab);
        const [est, cuerpo] = await wikiBorrar(env, u, b[1]);
        return json(cuerpo, est, cab);
      }
      return json({ error: "No existe" }, 404, cab);
    } catch (e) {
      return json({ error: "Error del servidor" }, 500, cab);
    }
  },
};
