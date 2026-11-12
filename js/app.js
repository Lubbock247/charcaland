const PAGINAS = [
  ["index.html", "Inicio"], ["updates.html", "Updates"], ["mods.html", "Mods"],
  ["eventos.html", "Eventos"], ["lore.html", "Lore"], ["mercadillo.html", "Mercadillo"], ["sugerencias.html", "Sugerencias"],
];

function esc(t) {
  const d = document.createElement("div");
  d.textContent = t;
  return d.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function fechaBonita(f) {
  return new Date(f + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

// ---- Sesión con Discord (compartida por todas las páginas) ----
// Discord devuelve el token en la dirección tras "Entrar"; se guarda en este navegador.
(function () {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get("access_token")) {
    try { localStorage.setItem("dc_token", h.get("access_token")); } catch {}
    history.replaceState(null, "", location.pathname);
  }
})();
function irALogin() {
  if (!CONFIG.discordClientId) return;
  const p = new URLSearchParams({ client_id: CONFIG.discordClientId, response_type: "token",
    scope: "identify guilds", redirect_uri: location.origin + location.pathname.replace(/[^/]*$/, "") + "sugerencias.html" });
  location.href = "https://discord.com/oauth2/authorize?" + p;
}
function avatarDe(u, t) {
  return u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=${t || 64}`
                  : "https://cdn.discordapp.com/embed/avatars/0.png";
}
function salir() { try { localStorage.removeItem("dc_token"); } catch {} location.reload(); }
// Devuelve {id, nombre, saldo, rol} o null si no hay sesión.
// Si ha entrado pero no está en el Discord del servidor, devuelve null y FUERA dice por qué.
let FUERA = null;
const SESION = (async () => {
  let t = null;
  try { t = localStorage.getItem("dc_token"); } catch {}
  if (!t || !CONFIG.api) return null;
  try {
    const r = await fetch(CONFIG.api + "/api/yo", { headers: { Authorization: "Bearer " + t } });
    if (r.ok) { const u = await r.json(); if (!u.fuera) return u; FUERA = u.fuera; return null; }
    if (r.status === 401) { try { localStorage.removeItem("dc_token"); } catch {} }
  } catch {}
  return null;
})();

// Cabecera y pie compartidos
(function () {
  const actual = location.pathname.split("/").pop() || "index.html";
  const enlaces = PAGINAS.map(([u, n]) =>
    `<a href="${u}" class="${u === actual ? "activa" : ""}">${n}</a>`).join("");
  document.getElementById("cabecera").innerHTML =
    `<div class="barra"><a class="logo" href="index.html"><span>▣</span> ${esc(CONFIG.nombreServidor)}</a><nav>${enlaces}</nav><div class="usuario" id="usuario"></div></div>`;
  SESION.then(u => {
    const el = document.getElementById("usuario");
    el.innerHTML = u
      ? `<span class="saldo" title="Tus monedas">${u.saldo} monedas</span><a href="perfil.html" class="perfil" title="Tu perfil"><img class="avatar" src="${avatarDe(u)}" alt="${esc(u.nombre)}"></a>`
      : `<a href="#" id="entrarNav">Entrar con Discord</a>`;
    const n = document.getElementById("entrarNav"); if (n) n.onclick = e => { e.preventDefault(); irALogin(); };
    if (FUERA) avisoFuera();
  });
  document.getElementById("pie").textContent = `${CONFIG.nombreServidor} · servidor privado de amigos`;
})();

// Llamadas a la API con la sesión de Discord (también la usa wiki.js).
async function api(ruta, opciones) {
  let t = null;
  try { t = localStorage.getItem("dc_token"); } catch {}
  const r = await fetch(CONFIG.api + ruta, {
    ...opciones,
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}) },
  });
  let datos = {};
  try { datos = await r.json(); } catch {}
  if (!r.ok) throw new Error(datos.error || "Error del servidor");
  return datos;
}

// Aviso en todas las páginas para quien ha entrado pero no está en el Discord del servidor.
function avisoFuera() {
  const permiso = FUERA === "permiso";
  // Sesión antigua sin el permiso nuevo: se le manda a entrar otra vez (solo una vez, para no hacer bucle).
  if (permiso) {
    let ya = false;
    try { ya = sessionStorage.getItem("reentrado"); sessionStorage.setItem("reentrado", "1"); } catch {}
    if (!ya) { irALogin(); return; }
  }
  const fondo = document.createElement("div");
  fondo.className = "fondo-fuera";
  const caja = document.createElement("div");
  caja.className = "aviso-fuera";
  fondo.appendChild(caja);
  caja.innerHTML = permiso
    ? `<p>La web ha cambiado: vuelve a entrar con Discord para seguir usándola.</p>
       <a class="btn" href="#" id="fueraEntrar">Volver a entrar</a>`
    : `<h2>Únete al Discord</h2>
       <p>Para usar la web tienes que estar en el Discord de ${esc(CONFIG.nombreServidor)}.</p>
       ${CONFIG.invitacionDiscord ? `<a class="btn" href="${esc(CONFIG.invitacionDiscord)}" target="_blank" rel="noopener">Unirme al Discord</a>` : ""}
       <a class="btn g" href="#" id="fueraComprobar">Ya me he unido, comprobar</a>
       <a class="btn g" href="#" id="fueraSalir">Salir</a>`;
  document.body.appendChild(fondo);
  const on = (id, f) => { const b = document.getElementById(id); if (b) b.onclick = e => { e.preventDefault(); f(); }; };
  on("fueraEntrar", irALogin); on("fueraComprobar", () => location.reload()); on("fueraSalir", salir);
}

// ---- Eventos y updates ----
const hoyMadrid = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const esVotacion = n => n.opciones && n.opciones.length > 1;
const esPasado = n => n.tipo === "evento" && n.fecha && n.fecha < hoyMadrid();
// Título como se muestra: en updates, "1.0.0 - Nombre"
const tituloNoticia = n => n.tipo === "update" && n.etiqueta ? `${n.etiqueta} - ${n.titulo}` : n.titulo;
const fechaNoticia = n => n.fecha ? fechaBonita(n.fecha) : "Fecha por decidir";
// Siguiente versión a la más alta (1.0.0 si no hay ninguna)
function siguienteVersion(items) {
  const vs = items.map(x => (x.etiqueta || "").split(".").map(Number)).filter(v => v.length === 3 && !v.some(isNaN));
  if (!vs.length) return "1.0.0";
  vs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const [M, m, p] = vs[vs.length - 1];
  return `${M}.${m}.${p + 1}`;
}

// Votación: se ve y se vota igual en la lista y dentro del evento.
function htmlVotacion(n, u, admin) {
  const total = n.opciones.reduce((s, o) => s + o.votos, 0);
  const abierta = !esPasado(n), puedeVotar = u && abierta;
  const mios = n.mis_votos || [];
  const max = Math.max(...n.opciones.map(o => o.votos));
  const etiq = [n.multiple ? "Varias respuestas" : "Una respuesta", n.anonima ? "Anónima" : "Pública"].join(" · ");
  return `<div class="votacion-caja"><div class="votacion-cab"><b>Votación</b><span>${etiq}</span></div>
    ${n.opciones.map(o => {
      const pct = total ? Math.round(o.votos * 100 / total) : 0;
      const mio = mios.includes(o.id), ganadora = !abierta && total && o.votos === max;
      const quien = o.votantes && o.votantes.length ? `<span class="votantes">${o.votantes.map(esc).join(", ")}${n.anonima ? " · solo lo ven los admins" : ""}</span>` : "";
      return `<${puedeVotar ? `button type="button" data-votar="${o.id}" data-noticia="${n.id}"` : "div"} class="opcion-voto ${mio ? "mia" : ""} ${ganadora ? "ganadora" : ""}">
        <span class="barra-voto" style="width:${pct}%"></span>
        <span class="marca-voto">${mio ? "✓" : ""}</span>
        <span class="txt-voto">${esc(o.texto)}${quien}</span><span class="num-voto">${o.votos}</span>
      </${puedeVotar ? "button" : "div"}>`; }).join("")}
    <p class="ayuda">${total} voto${total === 1 ? "" : "s"}${!abierta ? " · votación terminada" : u ? "" : " · entra con Discord para votar"}</p></div>`;
}

// Interruptor bonito (on/off) para el formulario
const interruptor = (nombre, texto, activo, ayuda) =>
  `<label class="interruptor"><input type="checkbox" name="${nombre}" ${activo ? "checked" : ""}><span class="pista"></span>
   <span><b>${texto}</b>${ayuda ? `<small>${ayuda}</small>` : ""}</span></label>`;

// Ventana para crear o editar un evento o una update (solo administradores), con vista previa.
function editorNoticia(tipo, n, items, alGuardar) {
  const ev = tipo === "evento";
  const fondo = document.createElement("div");
  fondo.className = "fondo-fuera";
  fondo.innerHTML = `<form class="aviso-fuera editor-noticia">
    <h2>${n ? "Editar" : ev ? "Nuevo" : "Nueva"} ${ev ? "evento" : "update"}</h2>
    ${ev ? "" : `<label>Versión</label><input name="etiqueta" required pattern="\\d+\\.\\d+\\.\\d+" value="${esc(n ? n.etiqueta : siguienteVersion(items))}">`}
    <label>Título</label><input name="titulo" required maxlength="120" value="${esc(n ? n.titulo : "")}">
    <label>Fecha</label><input name="fecha" type="date" ${ev ? "" : "required"} value="${esc(n ? n.fecha || "" : ev ? "" : hoyMadrid())}">
    ${ev ? `<div id="cajaInicio">${interruptor("en_inicio", "Mostrar en Inicio", n && n.en_inicio, "Para eventos sin fecha")}</div>` : ""}
    <label>Texto de vista previa</label><textarea name="resumen" class="corto" maxlength="300" required>${esc(n ? n.resumen : "")}</textarea>
    <label>Texto completo</label><textarea name="texto" maxlength="4000">${esc(n ? n.texto : "")}</textarea>
    ${ev ? `<label>Opciones de votación</label>
    <textarea name="opciones" class="corto" placeholder="Una opción por línea">${esc(n && n.opciones ? n.opciones.map(o => o.texto).join("\n") : "")}</textarea>
    <div id="cajaVotacion">
      ${interruptor("multiple", "Varias respuestas", n && n.multiple, "Cada uno puede votar más de una opción")}
      ${interruptor("anonima", "Anónima", n && n.anonima, "Solo los admins ven quién votó")}
    </div>` : ""}
    <label>Así se verá</label><div id="previaNoticia"></div>
    <div class="aviso oculto" id="errNoticia"></div>
    <button type="submit">Guardar</button> <a class="btn g" href="#" id="cancelarNoticia">Cancelar</a>
  </form>`;
  document.body.appendChild(fondo);
  const f = fondo.querySelector("form");
  const datos = () => {
    const d = Object.fromEntries(new FormData(f));
    d.opciones = (d.opciones || "").split("\n").map(t => t.trim()).filter(Boolean);
    for (const k of ["multiple", "anonima", "en_inicio"]) d[k] = !!d[k];
    return d;
  };
  const previa = () => {
    const d = datos();
    if (ev) {   // solo se enseña lo que aplica
      fondo.querySelector("#cajaInicio").classList.toggle("oculto", !!d.fecha);
      fondo.querySelector("#cajaVotacion").classList.toggle("oculto", d.opciones.length < 2);
    }
    fondo.querySelector("#previaNoticia").innerHTML = tarjetaNoticia({ ...d, tipo,
      titulo: d.titulo || "Título", resumen: d.resumen || "Texto de vista previa…",
      opciones: d.opciones.map((t, i) => ({ id: i, texto: t, votos: 0 })) }, null, null, false);
  };
  f.oninput = previa; previa();
  fondo.querySelector("#cancelarNoticia").onclick = e => { e.preventDefault(); fondo.remove(); };
  f.onsubmit = async e => {
    e.preventDefault();
    try {
      await api("/api/noticias", { method: "POST", body: JSON.stringify({ ...datos(), tipo, id: n ? n.id : undefined }) });
      fondo.remove(); alGuardar();
    } catch (er) { const m = fondo.querySelector("#errNoticia"); m.textContent = er.message; m.classList.remove("oculto"); }
  };
}

// Tarjeta de la lista. Se abre al pulsarla (menos al pulsar una opción de la votación).
function tarjetaNoticia(n, u, admin, clicable) {
  return `<div class="tarjeta noticia ${clicable ? "clicable" : ""} ${esPasado(n) ? "pasado" : ""}" ${clicable ? `data-abrir="${n.id}"` : ""}>
    <h3>${esc(tituloNoticia(n))}</h3><div class="fecha">${fechaNoticia(n)}</div><p>${esc(n.resumen)}</p>
    ${esVotacion(n) ? htmlVotacion(n, u, admin) : ""}</div>`;
}

// Página de Eventos o de Updates: tarjetas (con pestañas en eventos)
// y, al pulsar una, el texto completo (dirección #ID).
async function paginaNoticias(tipo) {
  const ev = tipo === "evento";
  const caja = document.getElementById("lista");
  const [u, items] = await Promise.all([SESION, api("/api/noticias/" + (ev ? "eventos" : "updates")).catch(() => null)]);
  if (!items) { caja.innerHTML = `<div class="vacio">No se pudieron cargar.</div>`; return; }
  const admin = u && u.rol === "admin";
  const recargar = () => paginaNoticias(tipo);
  const PESTANAS = [["inicio", "Inicio"], ["proximamente", "Próximamente"], ["pasados", "Pasados"]];

  function enlazar() {
    caja.querySelectorAll("[data-abrir]").forEach(t => t.onclick = () => { location.hash = t.dataset.abrir; });
    caja.querySelectorAll("[data-votar]").forEach(b => b.onclick = async e => {
      e.stopPropagation();
      try { await api("/api/votar", { method: "POST", body: JSON.stringify({ noticia_id: Number(b.dataset.noticia), opcion_id: Number(b.dataset.votar) }) }); recargar(); }
      catch (er) { alert(er.message); } });
  }

  function pintar() {
    const h = location.hash.slice(1);
    const n = /^\d+$/.test(h) && items.find(x => x.id == h);
    if (n) {   // Vista de una sola, con el texto completo
      caja.innerHTML = `<a href="#" class="btn g volver">← Volver</a>
        <div class="tarjeta noticia-completa ${esPasado(n) ? "pasado" : ""}">
        <h2>${esc(tituloNoticia(n))}</h2><div class="fecha">${fechaNoticia(n)}</div>
        <p class="resumen-noticia">${esc(n.resumen)}</p><div class="texto-noticia">${esc(n.texto)}</div>
        ${esVotacion(n) ? htmlVotacion(n, u, admin) : ""}
        ${admin ? `<div class="acciones-noticia"><a class="btn g" href="#" id="editarN">Editar</a><a class="btn g peligro" href="#" id="borrarN">Borrar</a></div>` : ""}</div>`;
      caja.querySelector(".volver").onclick = e => { e.preventDefault(); history.length > 1 ? history.back() : (location.hash = ""); };
      enlazar();
      if (admin) {
        document.getElementById("editarN").onclick = e => { e.preventDefault(); editorNoticia(tipo, n, items, recargar); };
        document.getElementById("borrarN").onclick = async e => { e.preventDefault();
          if (!confirm(`¿Borrar «${tituloNoticia(n)}»? No se puede deshacer.`)) return;
          try { await api("/api/noticias/" + n.id, { method: "DELETE" }); location.hash = ""; recargar(); } catch (er) { alert(er.message); } };
      }
      return;
    }
    let lista = items, pestanas = "", vacio = ev ? "No hay eventos aquí." : "Aún no hay updates.";
    if (ev) {
      const sel = PESTANAS.some(p => p[0] === h) ? h : "inicio";
      const hoy = hoyMadrid();
      const conFecha = items.filter(x => x.fecha && x.fecha >= hoy).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
      const sinFecha = items.filter(x => !x.fecha);
      if (sel === "inicio") {
        const cerca = conFecha.slice(0, 3);
        lista = [...cerca, ...items.filter(x => !cerca.includes(x) && !esPasado(x) && (esVotacion(x) || (!x.fecha && x.en_inicio)))];
        vacio = "No hay eventos próximos ni votaciones.";
      }
      if (sel === "proximamente") lista = [...conFecha, ...sinFecha];
      if (sel === "pasados") lista = items.filter(esPasado);
      pestanas = `<div class="wtabs pestanas-eventos">${PESTANAS.map(([id, t]) =>
        `<a href="#${id}" class="${id === sel ? "sel" : ""}">${t}</a>`).join("")}</div>`;
    }
    caja.innerHTML = pestanas + (admin ? `<div><a class="btn" href="#" id="nuevaNoticia">+ ${ev ? "Nuevo evento" : "Nueva update"}</a></div>` : "") +
      (lista.length ? lista.map(n => tarjetaNoticia(n, u, admin, true)).join("") : `<div class="vacio">${vacio}</div>`);
    enlazar();
    if (admin) document.getElementById("nuevaNoticia").onclick = e => { e.preventDefault(); editorNoticia(tipo, null, items, recargar); };
  }
  window.onhashchange = () => { pintar(); scrollTo(0, 0); };
  pintar();
}

const render = {
  updates() { paginaNoticias("update"); },
  mods() { if (location.hash.length > 1) document.body.classList.add("en-wiki"); iniciarWiki("mods"); },
  eventos() { paginaNoticias("evento"); },
  lore() { iniciarWiki("lore"); },
  async perfil() {
    const u = await SESION, caja = document.getElementById("perfil");
    if (!u) { caja.innerHTML = `<div class="vacio">Entra con Discord para ver tu perfil.<br><br><a class="btn" href="#" id="entrarPerfil">Entrar con Discord</a></div>`;
      document.getElementById("entrarPerfil").onclick = e => { e.preventDefault(); irALogin(); }; return; }
    caja.innerHTML = `<div class="tarjeta ficha"><img class="avatar grande" src="${avatarDe(u, 128)}" alt="">
      <div><h2 style="margin:0">${esc(u.nombre)}</h2>
      <span class="etiqueta ${u.rol === "admin" ? "" : "gris"}">${u.rol === "admin" ? "Administrador" : "Jugador"}</span>
      <p class="saldo" style="font-size:1.4rem;margin:8px 0">${u.saldo} monedas</p>
      <a class="btn g" href="#" id="btnSalir">Salir</a></div></div>`;
    document.getElementById("btnSalir").onclick = e => { e.preventDefault(); salir(); };
  },
  async inicio() {
    const [ups, evs] = await Promise.all([api("/api/noticias/updates").catch(() => []), api("/api/noticias/eventos").catch(() => [])]);
    const u = ups[0];
    const e = evs.filter(x => x.fecha && x.fecha >= hoyMadrid()).sort((a, b) => a.fecha < b.fecha ? -1 : 1)[0];
    document.getElementById("evento").innerHTML =
      (e ? `<a class="tarjeta" href="eventos.html#${e.id}"><h3>${esc(e.titulo)}</h3><p>${fechaBonita(e.fecha)}</p></a>`
         : `<a class="tarjeta" href="eventos.html#proximamente"><div class="icono">◆</div><h3>Eventos</h3><p>No hay eventos próximos con fecha</p></a>`) +
      `<a class="tarjeta" href="updates.html${u ? "#" + u.id : ""}"><div class="icono">◆</div><h3>Última update</h3><p>${esc(u ? tituloNoticia(u) : "Aún no hay updates")}</p></a>
       <a class="tarjeta" href="mercadillo.html"><div class="icono">◆</div><h3>Mercadillo</h3><p>Próximamente</p></a>`;
    const yo = await SESION;
    if (yo) document.getElementById("btnEntrar").classList.add("oculto");
    if (CONFIG.invitacionDiscord && !yo) {   // quien ya ha entrado está en el Discord
      const b = document.getElementById("btnDiscord");
      b.href = CONFIG.invitacionDiscord; b.classList.remove("oculto");
    }
  },
  async sugerencias() {
    const f = document.getElementById("form"), msg = document.getElementById("msg");
    const login = document.getElementById("login"), hola = document.getElementById("hola");
    const aviso = t => { msg.textContent = t; msg.classList.remove("oculto"); };
    const u = await SESION;
    if (!u) {
      f.classList.add("oculto"); login.classList.remove("oculto");
      document.getElementById("entrar").onclick = () => {
        if (!CONFIG.discordClientId) { aviso("El inicio de sesión aún no está configurado."); return; }
        irALogin();
      };
      return;
    }
    const usuario = u.nombre;
    hola.textContent = "Sesión iniciada como " + usuario;
    f.onsubmit = async ev => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      let t = null;
      try { t = localStorage.getItem("dc_token"); } catch {}
      try {
        const r = await fetch(CONFIG.api + "/api/sugerencia", { method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
          body: JSON.stringify({ tipo: d.tipo, texto: d.texto }) });
        const res = await r.json().catch(() => ({}));
        if (!r.ok) { aviso(res.error ? res.error + "." : "No se pudo enviar. Inténtalo más tarde."); return; }
        f.reset(); aviso("¡Gracias! Hemos recibido tu sugerencia.");
      } catch { aviso("No se pudo enviar. Inténtalo más tarde."); }
    };
  },
};
const cual = document.body.dataset.pagina;
if (render[cual]) render[cual]();
