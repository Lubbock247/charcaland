// Cuenta sin Discord (temporal) para un administrador concreto.
//
// - Entra por SU enlace: entrar.html#c=CÓDIGO. Solo ese enlace muestra el formulario.
//   El código se guarda resumido en bot_estado con la clave "enlace_<id>".
// - Con el enlace, entra con su correo (el apuntado en usuarios.correo) y su contraseña.
//   La primera vez, la contraseña que escriba (dos veces) queda como la suya.
// - En su perfil, «Conectar con Discord»: la cuenta de Discord con la que entre pasa a ser la suya.
//   Todo (monedas, anuncios, recibos…) se mueve a ese id, ese id pasa a ser admin en lugar del viejo
//   (bot_estado "admin_cambio_<viejo>") y el enlace, la contraseña y las sesiones se borran.

const enc = new TextEncoder();
const hexDe = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
export const resumen = async t => hexDe(await crypto.subtle.digest("SHA-256", enc.encode(t)));
const aleatorio = n => hexDe(crypto.getRandomValues(new Uint8Array(n)));

async function hashContrasena(contrasena, sal) {
  const clave = await crypto.subtle.importKey("raw", enc.encode(contrasena), "PBKDF2", false, ["deriveBits"]);
  return hexDe(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(sal), iterations: 100000 }, clave, 256));
}
const DIAS_SESION = 60;
async function nuevaSesion(env, id) {
  const token = "cl_" + aleatorio(32), ahora = Date.now();
  await env.DB.prepare("INSERT INTO sesiones (token, usuario_id, creado, caduca) VALUES (?1,?2,?3,?4)")
    .bind(await resumen(token), id, ahora, ahora + DIAS_SESION * 86400000).run();
  return token;
}

// Lista de administradores: la de wrangler.jsonc, con los cambios de id hechos al conectar Discord.
export async function listaAdmins(env) {
  const base = env.ADMIN_IDS.split(",").map(s => s.trim()).filter(Boolean);
  const cambios = (await env.DB.prepare("SELECT clave, valor FROM bot_estado WHERE clave LIKE 'admin_cambio_%'").all()).results;
  return base.map(id => (cambios.find(c => c.clave === "admin_cambio_" + id) || {}).valor || id);
}

// Para usuarioDe: la fila del usuario si el token de sesión es válido.
export async function usuarioLocal(env, token) {
  const s = await env.DB.prepare("SELECT usuario_id FROM sesiones WHERE token = ?1 AND caduca > ?2")
    .bind(await resumen(token), Date.now()).first();
  if (!s) return null;
  return env.DB.prepare("SELECT id, nombre, avatar, saldo FROM usuarios WHERE id = ?1").bind(s.usuario_id).first();
}

async function idDelEnlace(env, codigo) {
  if (!codigo) return null;
  const f = await env.DB.prepare("SELECT clave FROM bot_estado WHERE clave LIKE 'enlace_%' AND valor = ?1").bind(await resumen(String(codigo))).first();
  return f ? f.clave.slice(7) : null;
}

// Qué debe enseñar la página del enlace: si vale y si ya tiene contraseña.
export async function estadoEnlace(env, codigo) {
  const id = await idDelEnlace(env, codigo);
  if (!id) return [200, { vale: false }];
  const c = await env.DB.prepare("SELECT 1 FROM cuentas_locales WHERE usuario_id = ?1").bind(id).first();
  return [200, { vale: true, nueva: !c }];
}

const intentos = new Map(); // frena a quien prueba contraseñas: id -> [veces, desde]
function frenado(id) {
  const [n, t] = intentos.get(id) || [0, Date.now()];
  if (Date.now() - t > 15 * 60000) { intentos.delete(id); return false; }
  return n >= 8;
}

export async function entrar(env, d) {
  const id = await idDelEnlace(env, d.codigo);
  if (!id) return [403, { error: "Este enlace ya no sirve" }];
  if (frenado(id)) return [429, { error: "Demasiados intentos. Espera 15 minutos." }];
  const correo = String(d.correo || "").trim().toLowerCase(), contrasena = String(d.contrasena || "");
  const u = await env.DB.prepare("SELECT correo FROM usuarios WHERE id = ?1").bind(id).first();
  const fallo = () => { const [n, t] = intentos.get(id) || [0, Date.now()]; intentos.set(id, [n + 1, t]); return [401, { error: "Correo o contraseña incorrectos" }]; };
  if (!u || !u.correo || u.correo.toLowerCase() !== correo) return fallo();
  const c = await env.DB.prepare("SELECT hash, sal FROM cuentas_locales WHERE usuario_id = ?1").bind(id).first();
  if (!c) { // primera vez: la contraseña que escribe queda como la suya
    if (contrasena.length < 8) return [400, { error: "La contraseña tiene que tener al menos 8 caracteres" }];
    const sal = aleatorio(16);
    await env.DB.prepare("INSERT INTO cuentas_locales (usuario_id, login, hash, sal) VALUES (?1,?2,?3,?4)")
      .bind(id, correo, await hashContrasena(contrasena, sal), sal).run();
  } else if ((await hashContrasena(contrasena, c.sal)) !== c.hash) return fallo();
  intentos.delete(id);
  return [200, { token: await nuevaSesion(env, id) }];
}

export async function salir(env, token) {
  await env.DB.prepare("DELETE FROM sesiones WHERE token = ?1").bind(await resumen(token)).run();
  return [200, { ok: true }];
}

// Pasa todo del id viejo al de la cuenta de Discord y deja esa cuenta como la normal.
// «prueba» solo llega en local (PRUEBAS_LOCAL): simula la respuesta de Discord para probar el traspaso.
export async function conectarDiscord(env, tokenLocal, tokenDiscord, prueba) {
  const viejo = await usuarioLocal(env, tokenLocal);
  if (!viejo) return [401, { error: "Tu sesión ha caducado. Vuelve a entrar con tu enlace." }];
  let d = prueba || null;
  if (!d) {
    const r = await fetch("https://discord.com/api/oauth2/@me", { headers: { Authorization: "Bearer " + tokenDiscord } });
    d = r.ok ? await r.json() : null;
  }
  if (!d || !d.application || d.application.id !== env.DISCORD_CLIENT_ID || !d.user) return [400, { error: "No se pudo comprobar tu cuenta de Discord" }];
  const nuevo = d.user, de = viejo.id, a = nuevo.id;
  const s = [];
  if (a !== de) {
    // La fila del usuario nuevo: si ya existía (entró alguna vez), se le suman las monedas; si no, se crea.
    s.push(env.DB.prepare("INSERT INTO usuarios (id, nombre, avatar, saldo, en_servidor) VALUES (?1, ?2, ?3, 0, 0) ON CONFLICT(id) DO NOTHING")
      .bind(a, nuevo.global_name || nuevo.username, nuevo.avatar));
    s.push(env.DB.prepare("UPDATE usuarios SET saldo = saldo + (SELECT saldo FROM usuarios WHERE id = ?1) WHERE id = ?2").bind(de, a));
    const mover = [["anuncios", "autor_id"], ["anuncios", "comprador_id"], ["anuncios", "pujador_id"], ["pujas", "usuario_id"],
      ["movimientos", "usuario_id"], ["movimientos", "admin_id"], ["recibos", "comprador_id"], ["recibos", "vendedor_id"],
      ["imagenes", "autor_id"], ["paginas", "autor_id"], ["noticias", "autor_id"]];
    // (en anuncios hay que subir la versión: lo exige el trigger que evita cambios a la vez)
    for (const [t, c] of mover) s.push(env.DB.prepare(`UPDATE ${t} SET ${c} = ?1${t === "anuncios" ? ", version = version + 1" : ""} WHERE ${c} = ?2`).bind(a, de));
    // ofertas y votos tienen clave única: se pasan las que no choquen y se borran las demás
    s.push(env.DB.prepare("UPDATE OR IGNORE ofertas SET usuario_id = ?1 WHERE usuario_id = ?2").bind(a, de));
    s.push(env.DB.prepare("DELETE FROM ofertas WHERE usuario_id = ?1").bind(de));
    s.push(env.DB.prepare("UPDATE OR IGNORE votos SET usuario_id = ?1 WHERE usuario_id = ?2").bind(a, de));
    s.push(env.DB.prepare("DELETE FROM votos WHERE usuario_id = ?1").bind(de));
    s.push(env.DB.prepare("DELETE FROM usuarios WHERE id = ?1").bind(de));
    // el nuevo id es admin en lugar del viejo
    const base = env.ADMIN_IDS.split(",").map(x => x.trim());
    const original = base.includes(de) ? de : ((await env.DB.prepare("SELECT clave FROM bot_estado WHERE clave LIKE 'admin_cambio_%' AND valor = ?1").bind(de).first()) || { clave: "admin_cambio_" + de }).clave.slice(13);
    if (base.includes(original)) s.push(env.DB.prepare("INSERT INTO bot_estado (clave, valor) VALUES (?1, ?2) ON CONFLICT(clave) DO UPDATE SET valor = ?2").bind("admin_cambio_" + original, a));
  }
  s.push(env.DB.prepare("UPDATE usuarios SET correo = NULL WHERE id = ?1").bind(a)); // desde ahora, recibos por Discord
  s.push(env.DB.prepare("DELETE FROM cuentas_locales WHERE usuario_id = ?1").bind(de));
  s.push(env.DB.prepare("DELETE FROM sesiones WHERE usuario_id = ?1").bind(de));
  s.push(env.DB.prepare("DELETE FROM bot_estado WHERE clave = ?1").bind("enlace_" + de)); // el enlace deja de servir
  await env.DB.batch(s);
  return [200, { ok: true }];
}
