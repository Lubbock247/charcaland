// Wikis de Mods y Lore.
// Mods: una portada con todas las wikis; cada wiki es una página principal con sus subpáginas.
// Lore: cuatro apartados fijos. En las dos se puede enlazar otra página con [[Título]].
// El servidor vuelve a comprobar siempre los permisos de edición.

const CATEGORIAS_LORE = [
  ["mundo", "Mundo", "Solo administradores"],
  ["habilidades", "Habilidades", "Solo administradores"],
  ["personajes", "Personajes", "Cada jugador crea el suyo"],
  ["relaciones", "Relaciones", "Cada jugador crea las suyas"],
];
const PROPIAS = ["personajes", "relaciones"];

const normal = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const idDe = t => normal(t).replace(/ /g, "-") || "apartado";

// ---- Texto con formato (se escapa todo el HTML antes) ----
// resolver(nombre) devuelve la página enlazada o null. Devuelve { html, indice }.
function formato(texto, resolver) {
  const inline = t => esc(t)
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, nombre, mostrar) => {
      const p = resolver ? resolver(nombre) : null;
      return p ? `<a class="interno" href="#${p.slug}">${mostrar || nombre}</a>`
               : `<span class="roto" title="Esta página aún no existe">${mostrar || nombre}</span>`;
    })
    .replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  const salida = [], indice = [], usados = {};
  let lista = null, parrafo = [], tabla = null, caja = null;
  const cierraParrafo = () => { if (parrafo.length) { salida.push("<p>" + inline(parrafo.join(" ")) + "</p>"); parrafo = []; } };
  const cierraLista = () => { if (lista) { salida.push(`</${lista}>`); lista = null; } };
  const cierraTabla = () => {
    if (!tabla) return;
    const [cab, ...filas] = tabla;
    salida.push("<div class=\"tabla\"><table><thead><tr>" + cab.map(c => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>" +
      filas.map(f => "<tr>" + f.map(c => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table></div>");
    tabla = null;
  };
  const cierraTodo = () => { cierraParrafo(); cierraLista(); cierraTabla(); };
  for (const l of texto.split(/\r?\n/)) {
    let m;
    if (caja) {
      if (l.trim() === ":::") {
        salida.push(`<aside class="caja"><div class="cajat">${inline(caja.titulo)}</div><table>` +
          caja.filas.map(([k, v]) => `<tr><th>${inline(k)}</th><td>${inline(v)}</td></tr>`).join("") + "</table></aside>");
        caja = null;
      } else if ((m = l.match(/^([^:]+):\s*(.+)$/))) caja.filas.push([m[1], m[2]]);
      continue;
    }
    if ((m = l.match(/^:::caja\s*(.*)$/))) { cierraTodo(); caja = { titulo: m[1] || "Datos", filas: [] }; }
    else if ((m = l.match(/^(#{1,3}) (.+)/))) {
      cierraTodo();
      const n = m[1].length + 2;
      let id = idDe(m[2]); if (usados[id]) id += "-" + (++usados[id]); else usados[id] = 1;
      if (n <= 5) indice.push({ id, nivel: n, texto: m[2] });
      salida.push(`<h${n} id="${id}">${inline(m[2])}</h${n}>`);
    }
    else if (/^\|.*\|\s*$/.test(l)) {
      cierraParrafo(); cierraLista();
      const celdas = l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      if (celdas.every(c => /^:?-{2,}:?$/.test(c))) continue;
      if (!tabla) tabla = [];
      tabla.push(celdas);
    }
    else if ((m = l.match(/^- (.+)/))) { cierraParrafo(); cierraTabla(); if (lista !== "ul") { cierraLista(); salida.push("<ul>"); lista = "ul"; } salida.push("<li>" + inline(m[1]) + "</li>"); }
    else if ((m = l.match(/^\d+\. (.+)/))) { cierraParrafo(); cierraTabla(); if (lista !== "ol") { cierraLista(); salida.push("<ol>"); lista = "ol"; } salida.push("<li>" + inline(m[1]) + "</li>"); }
    else if (!l.trim()) cierraTodo();
    else { cierraLista(); cierraTabla(); parrafo.push(l); }
  }
  cierraTodo();
  return { html: salida.join("\n"), indice };
}

function resumenDe(t) {
  return (t || "").replace(/:::caja[\s\S]*?:::/g, "").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#*`|>-]/g, "").replace(/\s+/g, " ").trim().slice(0, 150);
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
  const porId = id => paginas.find(p => p.id === id);
  const porSlug = s => paginas.find(p => p.slug === s);
  const hijos = id => paginas.filter(p => (p.padre_id || null) === id);
  const wikiDe = p => { while (p && p.padre_id && porId(p.padre_id)) p = porId(p.padre_id); return p; };
  const resolver = nombre => porSlug(nombre) || paginas.find(p => normal(p.titulo) === normal(nombre)) || null;

  function arbol(p, nivel) {
    return `<a href="#${p.slug}" class="${actual === p.slug ? "sel" : ""}" style="padding-left:${10 + nivel * 14}px">${esc(p.titulo)}</a>` +
      hijos(p.id).map(h => arbol(h, nivel + 1)).join("");
  }

  function menu(wiki) {
    if (esLore) {
      let h = "";
      for (const [id, nombre, quien] of CATEGORIAS_LORE) {
        h += `<div class="grupo"><h4>${nombre}</h4><small>${quien}</small>` +
          paginas.filter(p => p.categoria === id).map(p => `<a href="#${p.slug}" class="${actual === p.slug ? "sel" : ""}">${esc(p.titulo)}</a>`).join("");
        if (puede(id, null)) h += `<a href="#nueva-${id}" class="nueva">+ ${PROPIAS.includes(id) && usuario.rol !== "admin" ? (id === "personajes" ? "Crear mi personaje" : "Crear una relación") : "Nueva página"}</a>`;
        h += `</div>`;
      }
      return h;
    }
    return `<div class="grupo"><a href="#" class="atras">← Todas las wikis</a><h4>${esc(wiki.titulo)}</h4>${arbol(wiki, 0)}` +
      (usuario && usuario.rol === "admin" ? `<a href="#nueva-en-${wiki.slug}" class="nueva">+ Nueva página</a>` : "") + `</div>`;
  }

  function pintar(contenido, wiki) {
    raiz.className = "wiki" + (esLore || wiki ? "" : " portada");
    raiz.innerHTML = (esLore || wiki ? `<nav class="menu">${menu(wiki)}</nav>` : "") + `<article class="pagina">${contenido}</article>`;
  }

  function portada() {
    actual = null;
    const wikis = paginas.filter(p => !p.padre_id);
    const nueva = usuario && usuario.rol === "admin" ? `<a class="tarjeta nuevawiki" href="#nueva">+ Nueva wiki</a>` : "";
    raiz.className = "wiki portada";
    raiz.innerHTML = `<div class="rejilla">` + wikis.map(w =>
      `<a class="tarjeta" href="#${w.slug}"><span class="etiqueta verde">Wiki</span><h3>${esc(w.titulo)}</h3><p>${esc(resumenDe(w.resumen))}</p>
       <p class="fecha" style="margin-top:8px">${hijos(w.id).length + 1} páginas</p></a>`).join("") + nueva + `</div>` +
      (wikis.length || nueva ? "" : `<div class="vacio">Aún no hay wikis.</div>`);
  }

  async function ver(slug) {
    let p;
    try { p = await api(`/api/wiki/${seccion}/${slug}`); }
    catch (e) { actual = null; pintar(`<div class="vacio">${esc(e.message)}</div>`, null); return; }
    actual = slug;
    const wiki = esLore ? null : wikiDe(porSlug(slug) || p);
    const botones = puede(p.categoria, p)
      ? `<div class="acciones"><a class="btn g" href="#editar-${p.slug}">Editar</a> <a class="btn g peligro" href="#" id="borrar">Borrar</a></div>` : "";
    const migas = esLore
      ? `<a href="lore.html">Lore</a> › ${esc(p.categoria)}`
      : `<a href="#">Mods</a> › ${wiki && wiki.slug !== p.slug ? `<a href="#${wiki.slug}">${esc(wiki.titulo)}</a> › ` : ""}${esc(p.titulo)}`;
    const { html, indice } = formato(p.contenido, resolver);
    const toc = indice.length >= 3
      ? `<div class="toc"><strong>Contenido</strong>` + indice.map(i => `<a href="#${p.slug}" data-ancla="${i.id}" style="padding-left:${(i.nivel - 3) * 14}px">${esc(i.texto)}</a>`).join("") + `</div>` : "";
    const autor = p.autor ? ` · por ${esc(p.autor)}` : "";
    pintar(`${botones}<div class="migas">${migas}</div><h2 class="wtitulo">${esc(p.titulo)}</h2><div class="fecha">${autor.slice(3)}</div>${toc}${html}`, wiki);
    raiz.querySelectorAll("[data-ancla]").forEach(a => a.onclick = e => {
      e.preventDefault(); document.getElementById(a.dataset.ancla)?.scrollIntoView({ behavior: "smooth" });
    });
    const b = document.getElementById("borrar");
    if (b) b.onclick = async e => {
      e.preventDefault();
      if (!confirm(`¿Borrar "${p.titulo}"? No se puede deshacer.`)) return;
      try { await api("/api/wiki/" + p.id, { method: "DELETE" }); await cargar(); location.hash = ""; await ruta(); } catch (er) { alert(er.message); }
    };
  }

  function editor(pagina, categoria, padreSlug) {
    actual = pagina ? pagina.slug : null;
    const admin = usuario && usuario.rol === "admin";
    const padreInicial = pagina ? pagina.padre_id : (padreSlug && porSlug(padreSlug) ? porSlug(padreSlug).id : null);
    const opcionesPadre = !esLore && admin
      ? `<label for="padre">Dentro de</label><select id="padre"><option value="">(ninguna: será una wiki nueva)</option>` +
        paginas.filter(p => !pagina || p.id !== pagina.id).map(p => `<option value="${p.id}" ${padreInicial === p.id ? "selected" : ""}>${esc(p.titulo)}</option>`).join("") + `</select>` : "";
    const cat = pagina ? pagina.categoria : categoria;
    const orden = admin ? `<label for="orden">Posición en el menú (0 = arriba)</label><input id="orden" type="number" value="${pagina ? pagina.orden : 0}">` : "";
    const wiki = pagina ? wikiDe(pagina) : (padreInicial ? wikiDe(porId(padreInicial)) : null);
    pintar(`<form id="fe" class="editor">
      <h2>${pagina ? "Editar página" : "Nueva página"}${esLore ? " · " + esc(cat) : ""}</h2>
      <label for="titulo">Título</label><input id="titulo" maxlength="80" required value="${pagina ? esc(pagina.titulo) : ""}">
      ${opcionesPadre}${orden}
      <label for="contenido">Contenido</label>
      <textarea id="contenido" style="min-height:300px" maxlength="20000">${pagina ? esc(pagina.contenido) : ""}</textarea>
      <details class="ayuda"><summary>Cómo dar formato</summary>
      <p><code># Apartado</code> · <code>## Subapartado</code> · <code>**negrita**</code> · <code>*cursiva*</code> · <code>- lista</code> · <code>1. lista numerada</code></p>
      <p><code>[[Otra página]]</code> enlaza otra página de la wiki (si no existe sale en rojo) · <code>[[Otra página|texto]]</code> con otro texto</p>
      <p><code>![texto](https://enlace-a-imagen)</code> imagen · <code>[texto](https://enlace)</code> enlace externo</p>
      <p>Tabla: <code>| Col 1 | Col 2 |</code>, luego <code>|---|---|</code> y las filas</p>
      <p>Caja de datos a la derecha: una línea <code>:::caja Título</code>, líneas <code>Clave: valor</code> y una línea <code>:::</code> al final</p></details>
      <button type="submit">Guardar</button> <a class="btn g" href="#${pagina ? pagina.slug : ""}">Cancelar</a>
      <div id="errorEd" class="aviso oculto"></div></form>`, wiki);
    document.getElementById("fe").onsubmit = async ev => {
      ev.preventDefault();
      const cuerpo = { titulo: document.getElementById("titulo").value, contenido: document.getElementById("contenido").value };
      if (pagina) cuerpo.id = pagina.id; else { cuerpo.seccion = seccion; cuerpo.categoria = cat; }
      const pa = document.getElementById("padre"); if (pa) cuerpo.padre_id = pa.value || null;
      const or = document.getElementById("orden"); if (or) cuerpo.orden = Number(or.value) || 0;
      try { const r = await api("/api/wiki", { method: "POST", body: JSON.stringify(cuerpo) }); await cargar(); location.hash = r.slug; await ruta(); }
      catch (er) { const e = document.getElementById("errorEd"); e.textContent = er.message; e.classList.remove("oculto"); }
    };
  }

  async function ruta() {
    const h = decodeURIComponent(location.hash.slice(1));
    let m;
    if ((m = h.match(/^nueva-en-([a-z0-9-]+)$/))) { if (!esLore && puede("", null)) return editor(null, "", m[1]); }
    else if ((m = h.match(/^nueva-(\w+)$/))) { if (puede(m[1], null)) return editor(null, m[1]); }
    else if (h === "nueva") { if (puede("", null)) return editor(null, ""); }
    else if ((m = h.match(/^editar-([a-z0-9-]+)$/))) {
      try { const p = await api(`/api/wiki/${seccion}/${m[1]}`); if (puede(p.categoria, p)) return editor(p); } catch {}
    } else if (h) return ver(h);
    if (!esLore) return portada();
    const primera = paginas[0];
    if (primera) return ver(primera.slug);
    actual = null;
    pintar(`<div class="vacio">Aún no hay páginas.</div>`, null);
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
