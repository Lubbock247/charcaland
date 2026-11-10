// API de Charcaland: cuentas con Discord, roles y saldo.
// Cada petición lleva el token de Discord del usuario; aquí se comprueba
// con Discord que es válido y que se creó para ESTA aplicación.

function cors(env, req) {
  const origen = req.headers.get("Origin") || "";
  const permitidos = env.ORIGENES.split(",");
  return {
    "Access-Control-Allow-Origin": permitidos.includes(origen) ? origen : permitidos[0],
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
      return json({ error: "No existe" }, 404, cab);
    } catch (e) {
      return json({ error: "Error del servidor" }, 500, cab);
    }
  },
};
