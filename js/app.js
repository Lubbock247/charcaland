const PAGINAS = [
  ["index.html", "Inicio"], ["updates.html", "Updates"], ["mods.html", "Mods"],
  ["eventos.html", "Eventos"], ["lore.html", "Lore"], ["sugerencias.html", "Sugerencias"],
];

function esc(t) {
  const d = document.createElement("div");
  d.textContent = t;
  return d.innerHTML;
}
function fechaBonita(f) {
  return new Date(f + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

// Cabecera y pie compartidos
(function () {
  const actual = location.pathname.split("/").pop() || "index.html";
  const enlaces = PAGINAS.map(([u, n]) =>
    `<a href="${u}" class="${u === actual ? "activa" : ""}">${n}</a>`).join("");
  document.getElementById("cabecera").innerHTML =
    `<div class="barra"><a class="logo" href="index.html"><span>▣</span> ${esc(CONFIG.nombreServidor)}</a><nav>${enlaces}</nav></div>`;
  document.getElementById("pie").textContent = `${CONFIG.nombreServidor} · servidor privado de amigos`;
})();

const render = {
  updates() {
    document.getElementById("lista").innerHTML = UPDATES.map(u =>
      `<div class="tarjeta"><span class="etiqueta">${esc(u.etiqueta)}</span>
       <h3>${esc(u.titulo)}</h3><div class="fecha">${fechaBonita(u.fecha)}</div><p>${esc(u.texto)}</p></div>`).join("");
  },
  mods() {
    document.getElementById("lista").innerHTML = MODS.map(m =>
      `<div class="tarjeta" style="margin-bottom:16px"><span class="etiqueta verde">${esc(m.estado)}</span>
       <h3>${esc(m.nombre)}</h3><p>${esc(m.resumen)}</p>
       <ul>${m.detalles.map(d => `<li>${esc(d)}</li>`).join("")}</ul></div>`).join("");
  },
  eventos() {
    document.getElementById("lista").innerHTML = EVENTOS.map(e =>
      `<div class="tarjeta"><span class="etiqueta ${e.estado === "Próximo" ? "verde" : "gris"}">${esc(e.estado)}</span>
       <h3>${esc(e.titulo)}</h3><div class="fecha">${fechaBonita(e.fecha)}</div><p>${esc(e.texto)}</p></div>`).join("");
  },
  lore() {
    document.getElementById("lista").innerHTML = LORE.map(c =>
      `<div class="capitulo"><h2>${esc(c.titulo)}</h2><p>${esc(c.texto)}</p></div>`).join("");
  },
  inicio() {
    const u = UPDATES[0], e = EVENTOS[0];
    document.getElementById("novedad").innerHTML =
      `<a class="tarjeta" href="updates.html"><span class="etiqueta">Última novedad</span><h3>${esc(u.titulo)}</h3><p>${esc(u.texto)}</p></a>
       <a class="tarjeta" href="eventos.html"><span class="etiqueta verde">Próximo evento</span><h3>${esc(e.titulo)}</h3><p>${fechaBonita(e.fecha)}</p></a>`;
  },
  async sugerencias() {
    const f = document.getElementById("form"), msg = document.getElementById("msg");
    const login = document.getElementById("login"), hola = document.getElementById("hola");
    const aviso = t => { msg.textContent = t; msg.classList.remove("oculto"); };
    // Discord devuelve el token en la dirección tras "Entrar"; lo guardamos solo en esta pestaña.
    const hash = new URLSearchParams(location.hash.slice(1));
    if (hash.get("access_token")) {
      try { sessionStorage.setItem("dc_token", hash.get("access_token")); } catch {}
      history.replaceState(null, "", location.pathname);
    }
    let token = null;
    try { token = sessionStorage.getItem("dc_token"); } catch {}
    let usuario = null;
    if (token) {
      try {
        const r = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + token } });
        if (r.ok) { const u = await r.json(); usuario = u.global_name || u.username; }
        else { try { sessionStorage.removeItem("dc_token"); } catch {} }
      } catch {}
    }
    if (!usuario) {
      f.classList.add("oculto"); login.classList.remove("oculto");
      document.getElementById("entrar").onclick = () => {
        if (!CONFIG.discordClientId) { aviso("El inicio de sesión aún no está configurado."); return; }
        const p = new URLSearchParams({ client_id: CONFIG.discordClientId, response_type: "token",
          scope: "identify", redirect_uri: location.origin + location.pathname });
        location.href = "https://discord.com/oauth2/authorize?" + p;
      };
      return;
    }
    hola.textContent = "Sesión iniciada como " + usuario;
    f.onsubmit = async ev => {
      ev.preventDefault();
      if (!CONFIG.webhookDiscord) { aviso("El buzón aún no está conectado. Cuéntaselo al administrador."); return; }
      const d = Object.fromEntries(new FormData(f));
      const contenido = `**Sugerencia de ${usuario}:**
(${d.tipo})
${d.texto}`;
      try {
        const r = await fetch(CONFIG.webhookDiscord, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "oompa-lompa", content: contenido, allowed_mentions: { parse: [] } }) });
        if (!r.ok) throw 0;
        f.reset(); aviso("¡Gracias! Hemos recibido tu sugerencia.");
      } catch { aviso("No se pudo enviar. Inténtalo más tarde."); }
    };
  },
};
const cual = document.body.dataset.pagina;
if (render[cual]) render[cual]();
