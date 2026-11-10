// Wikis de Mods y Lore: lista de páginas a la izquierda, contenido a la derecha,
// y editor para quien tenga permiso (el servidor lo vuelve a comprobar siempre).

const CATEGORIAS_LORE = [
  ["mundo", "Mundo", "Solo administradores"],
  ["habilidades", "Habilidades", "Solo administradores"],
  ["personajes", "Personajes", "Cada jugador crea el suyo"],
  ["relaciones", "Relaciones", "Cada jugador crea las suyas"],
];
const PROPIAS = ["personajes", "relaciones"];

// ---- Texto con formato sencillo (se escapa todo el HTML antes) ----
function formato(texto) {
  const inline = t => esc(t)
    .replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  const salida = [];
  let lista = null, parrafo = [];
  const cierraParrafo = () => { if (parrafo.length) { salida.push("<p>" + inline(parrafo.join(" ")) + "</p>"); parrafo = []; } };
  const cierraLista = () => { if (lista) { salida.push(`</${lista}>`); lista = null; } };
  for (const l of texto.split("\n")) {
    let m;
    if ((m = l.match(/^(#{1,3}) (.+)/))) { cierraParrafo(); cierraLista(); salida.push(`<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`); }
    else if ((m = l.match(/^- (.+)/))) { cierraParrafo(); if (lista !== "ul") { cierraLista(); salida.push("<ul>"); lista = "ul"; } salida.push("<li>" + inline(m[1]) + "</li>"); }
    else if ((m = l.match(/^\d+\. (.+)/))) { cierraParrafo(); if (lista !== "ol") { cierraLista(); salida.push("<ol>"); lista = "ol"; } salida.push("<li>" + inline(m[1]) + "</li>"); }
    else if (!l.trim()) { cierraParrafo(); cierraLista(); }
    else { cierraLista(); parrafo.push(l); }
  }
  cierraParrafo(); cierraLista();
  return salida.join("\n");
}

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

function iniciarWiki(seccion) {
  const raiz = document.getElementById("wiki");
  let paginas = [], usuario = null, actual = null;
  const esLore = seccion === "lore";

  const puede = (cat, pagina) => {
    if (!usuario) return false;
    if (usuario.rol === "admin") return true;
    return esLore && PROPIAS.includes(cat) && (!pagina || pagina.autor_id === usuario.id);
  };

  function arbol(padre, nivel) {
    return paginas.filter(p => (p.padre_id || null) === padre).map(p =>
      `<a href="#${p.slug}" class="${actual === p.slug ? "sel" : ""}" style="padding-left:${10 + nivel * 14}px">${esc(p.titulo)}</a>` +
      arbol(p.id, nivel + 1)).join("");
  }

  function menu() {
    let h = "";
    if (esLore) {
      for (const [id, nombre, quien] of CATEGORIAS_LORE) {
        const dela = paginas.filter(p => p.categoria === id);
        h += `<div class="grupo"><h4>${nombre}</h4><small>${quien}</small>` +
          dela.map(p => `<a href="#${p.slug}" class="${actual === p.slug ? "sel" : ""}">${esc(p.titulo)}</a>`).join("");
        if (puede(id, null)) h += `<a href="#nueva-${id}" class="nueva">+ ${PROPIAS.includes(id) && usuario.rol !== "admin" ? (id === "personajes" ? "Crear mi personaje" : "Crear una relación") : "Nueva página"}</a>`;
        h += `</div>`;
      }
    } else {
      h = `<div class="grupo">${arbol(null, 0)}${usuario && usuario.rol === "admin" ? `<a href="#nueva" class="nueva">+ Nueva página</a>` : ""}</div>`;
    }
    return h;
  }

  function pintar(contenido) {
    raiz.innerHTML = `<nav class="menu">${menu()}</nav><article class="pagina">${contenido}</article>`;
  }

  async function ver(slug) {
    actual = slug;
    let p;
    try { p = await api(`/api/wiki/${seccion}/${slug}`); }
    catch (e) { pintar(`<div class="vacio">${esc(e.message)}</div>`); return; }
    const botones = puede(p.categoria, p)
      ? `<div class="acciones"><a class="btn g" href="#editar-${p.slug}">Editar</a> <a class="btn g peligro" href="#" id="borrar">Borrar</a></div>` : "";
    const autor = p.autor ? ` · por ${esc(p.autor)}` : "";
    pintar(`${botones}<div class="fecha">${esLore ? esc(p.categoria) : "Mods"}${autor}</div>${formato(p.contenido)}`);
    const b = document.getElementById("borrar");
    if (b) b.onclick = async e => {
      e.preventDefault();
      if (!confirm(`¿Borrar "${p.titulo}"? No se puede deshacer.`)) return;
      try { await api("/api/wiki/" + p.id, { method: "DELETE" }); await cargar(); location.hash = ""; } catch (er) { alert(er.message); }
    };
  }

  function editor(pagina, categoria) {
    actual = pagina ? pagina.slug : null;
    const admin = usuario && usuario.rol === "admin";
    const opcionesPadre = !esLore && admin
      ? `<label for="padre">Dentro de</label><select id="padre"><option value="">(página principal)</option>` +
        paginas.filter(p => !pagina || p.id !== pagina.id).map(p => `<option value="${p.id}" ${pagina && pagina.padre_id === p.id ? "selected" : ""}>${esc(p.titulo)}</option>`).join("") + `</select>` : "";
    const cat = pagina ? pagina.categoria : categoria;
    const orden = admin ? `<label for="orden">Posición en el menú (0 = arriba)</label><input id="orden" type="number" value="${pagina ? pagina.orden : 0}">` : "";
    pintar(`<form id="fe" class="editor">
      <h2>${pagina ? "Editar página" : "Nueva página"}${esLore ? " · " + esc(cat) : ""}</h2>
      <label for="titulo">Título</label><input id="titulo" maxlength="80" required value="${pagina ? esc(pagina.titulo) : ""}">
      ${opcionesPadre}${orden}
      <label for="contenido">Contenido</label>
      <textarea id="contenido" style="min-height:280px" maxlength="20000">${pagina ? esc(pagina.contenido) : ""}</textarea>
      <p class="fecha">Formato: <code># Título</code> · <code>## Subtítulo</code> · <code>**negrita**</code> · <code>*cursiva*</code> · <code>- lista</code> · <code>![texto](https://enlace-a-imagen)</code> · <code>[texto](https://enlace)</code></p>
      <button type="submit">Guardar</button> <a class="btn g" href="#${pagina ? pagina.slug : ""}">Cancelar</a>
      <div id="errorEd" class="aviso oculto"></div></form>`);
    document.getElementById("fe").onsubmit = async ev => {
      ev.preventDefault();
      const cuerpo = { titulo: document.getElementById("titulo").value, contenido: document.getElementById("contenido").value };
      if (pagina) cuerpo.id = pagina.id; else { cuerpo.seccion = seccion; cuerpo.categoria = cat; }
      const pa = document.getElementById("padre"); if (pa) cuerpo.padre_id = pa.value || null;
      const or = document.getElementById("orden"); if (or) cuerpo.orden = Number(or.value) || 0;
      try { const r = await api("/api/wiki", { method: "POST", body: JSON.stringify(cuerpo) }); await cargar(); location.hash = r.slug; }
      catch (er) { const e = document.getElementById("errorEd"); e.textContent = er.message; e.classList.remove("oculto"); }
    };
  }

  async function ruta() {
    const h = decodeURIComponent(location.hash.slice(1));
    let m;
    if ((m = h.match(/^nueva-(\w+)$/))) { if (puede(m[1], null)) return editor(null, m[1]); }
    else if (h === "nueva") { if (puede("", null)) return editor(null, ""); }
    else if ((m = h.match(/^editar-([a-z0-9-]+)$/))) {
      try { const p = await api(`/api/wiki/${seccion}/${m[1]}`); if (puede(p.categoria, p)) return editor(p); } catch {}
    } else if (h) return ver(h);
    const primera = paginas.find(p => !p.padre_id) || paginas[0];
    if (primera) return ver(primera.slug);
    actual = null;
    pintar(`<div class="vacio">Aún no hay páginas.</div>`);
  }

  async function cargar() {
    try { paginas = await api("/api/wiki/" + seccion); }
    catch { raiz.innerHTML = `<div class="vacio">No se pudo cargar. Inténtalo más tarde.</div>`; return false; }
    return true;
  }

  (async () => {
    usuario = await SESION;
    if (await cargar()) { await ruta(); window.addEventListener("hashchange", ruta); }
  })();
}
