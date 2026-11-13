// «/clear» en el chat privado con el bot (solo los administradores de ADMIN_IDS):
//   - Respondiendo a un mensaje del bot con «/clear»: borra ese mensaje.
//   - «/clear» sin responder a nada: borra todos los mensajes del bot en ese chat.
// No es un comando de Discord (no hay autocompletado): es un mensaje normal que la API lee.
// El Cron lo mira cada minuto, así que tarda hasta 1 minuto en hacerse.
// El bot solo puede borrar sus propios mensajes; el «/clear» que escribes lo borras tú.

const API = "https://discord.com/api/v10";
const bot = env => ({ Authorization: "Bot " + env.DISCORD_BOT_TOKEN, "Content-Type": "application/json" });

// Borra con reintento si Discord pide esperar (límite de velocidad).
async function borrar(env, canal, id) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${API}/channels/${canal}/messages/${id}`, { method: "DELETE", headers: bot(env) });
    if (r.status !== 429) return r.ok || r.status === 404;
    const espera = ((await r.json().catch(() => ({}))).retry_after || 1) * 1000;
    await new Promise(ok => setTimeout(ok, espera));
  }
  return false;
}

async function borrarTodos(env, canal) {
  let antes = null;
  for (let vuelta = 0; vuelta < 20; vuelta++) { // hasta 2000 mensajes
    const r = await fetch(`${API}/channels/${canal}/messages?limit=100${antes ? "&before=" + antes : ""}`, { headers: bot(env) });
    if (!r.ok) return;
    const msgs = await r.json();
    if (!msgs.length) return;
    antes = msgs[msgs.length - 1].id;
    for (const m of msgs) if (m.author.id === env.DISCORD_CLIENT_ID) await borrar(env, canal, m.id);
  }
}

// Compara ids de Discord (son números demasiado grandes para JavaScript normal).
const masNuevo = (a, b) => BigInt(a) > BigInt(b);

export async function revisarClear(env) {
  if (!env.DISCORD_BOT_TOKEN) return;
  const admins = env.ADMIN_IDS.split(",").map(s => s.trim()).filter(Boolean);
  for (const admin of admins) {
    try {
      const dm = await fetch(`${API}/users/@me/channels`, { method: "POST", headers: bot(env), body: JSON.stringify({ recipient_id: admin }) });
      if (!dm.ok) continue;
      const canal = (await dm.json()).id;
      const clave = "dm_" + admin;
      const visto = await env.DB.prepare("SELECT valor FROM bot_estado WHERE clave = ?1").bind(clave).first();
      const r = await fetch(`${API}/channels/${canal}/messages?limit=50`, { headers: bot(env) });
      if (!r.ok) continue;
      const msgs = await r.json(); // del más nuevo al más viejo
      if (!msgs.length) continue;
      // La primera vez solo se apunta dónde está el chat, para no hacer caso a «/clear» antiguos.
      if (visto) {
        const nuevos = msgs.filter(m => masNuevo(m.id, visto.valor) && m.author.id === admin && m.content.trim().toLowerCase() === "/clear").reverse();
        for (const m of nuevos) {
          const ref = m.referenced_message;
          // Respondiendo a un mensaje: solo ese (si ya no existe, nada). Sin responder: todos.
          if (m.message_reference) { if (ref && ref.author.id === env.DISCORD_CLIENT_ID) await borrar(env, canal, ref.id); }
          else await borrarTodos(env, canal);
        }
      }
      await env.DB.prepare("INSERT INTO bot_estado (clave, valor) VALUES (?1, ?2) ON CONFLICT(clave) DO UPDATE SET valor = ?2")
        .bind(clave, msgs[0].id).run();
    } catch (e) { console.error("/clear", admin, e.message); }
  }
}
