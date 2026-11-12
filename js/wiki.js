// Wikis de Mods y Lore, al estilo de las wikis de juegos.
// Mods: portada con una caja por wiki. Cada wiki tiene secciones (pestañas de arriba)
//       y cada sección sus páginas (menú de la izquierda).
// Lore: una sola wiki cuyas pestañas son los apartados fijos (Mundo, Personajes...).
// El servidor vuelve a comprobar siempre los permisos de edición.

const CATEGORIAS_LORE = [
  ["mundo", "Mundo", "Solo administradores"],
  ["habilidades", "Habilidades", "Solo administradores"],
  ["personajes", "Personajes", "Cada jugador crea el suyo"],
  ["relaciones", "Relaciones", "Cada jugador crea las suyas"],
];
const PROPIAS = ["personajes", "relaciones"];
const ICONOS = ["sparkles", "sword", "wand", "shield", "flame", "skull", "crown", "book", "map",
  "diamond", "bolt", "ghost", "snowflake", "trees", "pick", "flask", "planet"];

const normal = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const idDe = t => normal(t).replace(/ /g, "-") || "apartado";
const icono = (n, extra) => `<i class="ti ti-${esc(n || "book")}${extra ? " " + extra : ""}" aria-hidden="true"></i>`;

// ---------- Texto con formato (todo el HTML se escapa antes) ----------
// resolver(nombre) devuelve la página enlazada o null. Devuelve { html, indice }.
function formato(texto, resolver) {
  const inline = t => esc(t)
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, nombre, mostrar) => {
      const p = resolver ? resolver(nombre.trim()) : null;
      return p ? `<a class="interno" href="#${p.slug}">${mostrar || nombre}</a>`
               : `<span class="roto" title="Esta página aún no existe">${mostrar || nombre}</span>`;
    })
    .replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  const salida = [], indice = [], usados = {};
  let lista = null, parrafo = [], tabla = null, bloque = null;
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
  const cierraBloque = () => {
    if (bloque.tipo === "caja") {
      const img = bloque.filas.find(([k]) => normal(k) === "imagen");
      const filas = bloque.filas.filter(f => f !== img);
      const urlImg = img && /^https:\/\/\S+$/.test(img[1].trim()) ? img[1].trim() : null;
      salida.push(`<aside class="caja"><div class="cajat">${inline(bloque.titulo)}</div>` +
        (urlImg ? `<div class="cajai"><img src="${esc(urlImg)}" alt="" loading="lazy"></div>` : "") +
        `<table>` + filas.map(([k, v]) => `<tr><th>${inline(k)}</th><td>${inline(v)}</td></tr>`).join("") + "</table></aside>");
    } else {
      salida.push(`<div class="habs">` + bloque.filas.map(partes => {
        const [nivel, nombre, desc] = partes.length >= 3 ? partes
          : /^nivel\s*\d+$/i.test(partes[0]) ? [partes[0], partes[1] || "", ""] : ["", partes[0], partes[1] || ""];
        return `<div class="hab">${nivel ? `<span class="nivel">${inline(nivel)}</span>` : ""}<strong>${inline(nombre || "")}</strong>${desc ? `<p>${inline(desc)}</p>` : ""}</div>`;
      }).join("") + `</div>`);
    }
    bloque = null;
  };
  for (const l of texto.split(/\r?\n/)) {
    let m;
    if (bloque) {
      if (l.trim() === ":::") cierraBloque();
      else if (bloque.tipo === "caja" && (m = l.match(/^([^:]+):\s*(.+)$/))) bloque.filas.push([m[1], m[2]]);
      else if (bloque.tipo === "habilidades" && l.trim()) bloque.filas.push(l.split("|").map(s => s.trim()));
      continue;
    }
    if ((m = l.match(/^:::caja\s*(.*)$/))) { cierraTodo(); bloque = { tipo: "caja", titulo: m[1] || "Datos", filas: [] }; }
    else if (/^:::habilidades\s*$/.test(l)) { cierraTodo(); bloque = { tipo: "habilidades", filas: [] }; }
    else if ((m = l.match(/^(#{1,3}) (.+)/))) {
      cierraTodo();
      const n = m[1].length + 2;
      let id = idDe(m[2]); if (usados[id]) id += "-" + (++usados[id]); else usados[id] = 1;
      if (n <= 4) indice.push({ id, nivel: n, texto: m[2] });
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
  if (bloque) cierraBloque();
  cierraTodo();
  return { html: salida.join("\n"), indice };
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

// ---------- Botones del editor ----------
const PLANTILLAS = {
  caja: ":::caja Nombre\nImagen: https://enlace-a-una-imagen.png\nTipo: valor\nNiveles: valor\n:::",
  habilidades: ":::habilidades\nNivel 1 | Nombre de la habilidad | Qué hace\nNivel 2 | Otra habilidad | Qué hace\n:::",
  tabla: "| Columna 1 | Columna 2 |\n|---|---|\n| Dato | Dato |\n| Dato | Dato |",
};
function insertarBloque(ta, texto) {
  const s = ta.selectionStart, antes = ta.value.slice(0, s);
  const pre = !antes ? "" : antes.endsWith("\n\n") ? "" : antes.endsWith("\n") ? "\n" : "\n\n";
  ta.setRangeText(pre + texto + "\n", s, ta.selectionEnd, "end");
  ta.focus(); ta.dispatchEvent(new Event("input"));
}
function envolver(ta, antes, despues, ejemplo) {
  const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || ejemplo;
  ta.setRangeText(antes + sel + despues, s, e, "end");
  ta.setSelectionRange(s + antes.length, s + antes.length + sel.length);
  ta.focus(); ta.dispatchEvent(new Event("input"));
}
function seleccion(ta) { return ta.value.slice(ta.selectionStart, ta.selectionEnd); }

function iniciarWiki(seccion) {
  const raiz = document.getElementById("wiki");
  const esLore = seccion === "lore";
  let paginas = [], usuario = null;

  const admin = () => !!usuario && usuario.rol === "admin";
  const puede = (cat, pagina) => {
    if (!usuario) return false;
    if (usuario.rol === "admin") return true;
    return esLore && PROPIAS.includes(cat) && (!pagina || pagina.autor_id === usuario.id);
  };
  const porId = id => paginas.find(p => p.id === id);
  const porSlug = s => paginas.find(p => p.slug === s);
  const hijos = id => paginas.filter(p => (p.padre_id || null) === id);
  // Cadena desde la wiki hasta la página: [wiki, sección, ..., página]
  const cadena = p => { const c = []; while (p && c.length < 20) { c.unshift(p); p = p.padre_id ? porId(p.padre_id) : null; } return c; };
  const resolver = nombre => porSlug(nombre) || paginas.find(p => normal(p.titulo) === normal(nombre)) || null;
  const nombreCat = id => (CATEGORIAS_LORE.find(c => c[0] === id) || [id, id])[1];

  // ---------- Piezas de la página ----------
  function cabecera(titulo, ico, pestanas, extra) {
    return `<div class="wban"><div class="wnombre">${icono(ico)} ${esc(titulo)}</div>
      <div class="wtabs">${pestanas.map(([href, txt, sel]) => `<a href="${href}" class="${sel ? "sel" : ""}">${esc(txt)}</a>`).join("")}${extra || ""}</div></div>`;
  }
  // Dentro de una wiki sobra el título grande de la página ("Mods", "Lore"): ya lo dice la cabecera
  function pintar(cab, menu, articulo) {
    document.body.classList.add("en-wiki");
    raiz.className = "wiki2";
    raiz.innerHTML = cab + `<div class="wcuerpo${menu === null ? " solo" : ""}">` +
      (menu === null ? "" : `<nav class="wmenu">${menu}</nav>`) + `<article class="pagina">${articulo}</article></div>`;
  }
  function arbol(p, actual, nivel) {
    return `<a href="#${p.slug}" class="${actual === p.slug ? "sel" : ""}" style="padding-left:${10 + nivel * 14}px">${esc(p.titulo)}</a>` +
      hijos(p.id).map(h => arbol(h, actual, nivel + 1)).join("");
  }

  // Cabecera de una wiki de Mods: pestañas Inicio + secciones
  function cabeceraMods(wiki, seccionActual) {
    const tabs = [[`#${wiki.slug}`, "Inicio", !seccionActual]].concat(
      hijos(wiki.id).map(s => [`#${s.slug}`, s.titulo, seccionActual && seccionActual.id === s.id]));
    return cabecera(wiki.titulo, wiki.icono, tabs, admin() ? `<a href="#nueva-seccion-${wiki.slug}" class="mas">+ Sección</a>` : "");
  }
  function cabeceraLore(cat) {
    return cabecera("Lore de " + CONFIG.nombreServidor, "book",
      CATEGORIAS_LORE.map(([id, nombre]) => [`#cat-${id}`, nombre, cat === id]));
  }
  function menuLore(cat, actual) {
    const [, , quien] = CATEGORIAS_LORE.find(c => c[0] === cat);
    let h = `<small class="quien">${quien}</small>` +
      paginas.filter(p => p.categoria === cat).map(p => `<a href="#${p.slug}" class="${actual === p.slug ? "sel" : ""}">${esc(p.titulo)}</a>`).join("");
    if (puede(cat, null)) h += `<a href="#nueva-${cat}" class="mas">+ ${PROPIAS.includes(cat) && !admin() ? (cat === "personajes" ? "Crear mi personaje" : "Crear una relación") : "Página aquí"}</a>`;
    return h;
  }

  // ---------- Vistas ----------
  function portada() {
    document.body.classList.remove("en-wiki");
    raiz.className = "wiki2";
    const wikis = paginas.filter(p => !p.padre_id);
    raiz.innerHTML = `<div class="hub">` +
      wikis.map(w => `<a class="cuadro" href="#${w.slug}">${icono(w.icono)}<span>${esc(w.titulo)}</span></a>`).join("") +
      (admin() ? `<a class="cuadro nuevo" href="#nueva">${icono("plus")}<span>Nueva wiki</span></a>` : "") + `</div>` +
      (wikis.length || admin() ? "" : `<div class="vacio">Aún no hay wikis.</div>`);
  }

  function articulo(p, migas) {
    const botones = puede(p.categoria, p)
      ? `<div class="acciones"><a class="btn g" href="#editar-${p.slug}">${icono("pencil")} Editar</a> <a class="btn g peligro" href="#" id="borrar">${icono("trash")}</a></div>` : "";
    const { html, indice } = formato(p.contenido, resolver);
    const toc = indice.length >= 4
      ? `<div class="toc"><strong>En esta página</strong>` + indice.map(i => `<a href="#${p.slug}" data-ancla="${i.id}" style="padding-left:${(i.nivel - 3) * 14}px">${esc(i.texto)}</a>`).join("") + `</div>` : "";
    const autor = p.autor && esLore ? `<div class="fecha">por ${esc(p.autor)}</div>` : "";
    return `${botones}<div class="migas">${migas}</div><h2 class="wtitulo">${esc(p.titulo)}</h2>${autor}${toc}${html}`;
  }
  function activarArticulo(p, alBorrar) {
    raiz.querySelectorAll("[data-ancla]").forEach(a => a.onclick = e => {
      e.preventDefault(); document.getElementById(a.dataset.ancla)?.scrollIntoView({ behavior: "smooth" });
    });
    const b = document.getElementById("borrar");
    if (b) b.onclick = async e => {
      e.preventDefault();
      if (!confirm(`¿Borrar "${p.titulo}"? No se puede deshacer.`)) return;
      try { await api("/api/wiki/" + p.id, { method: "DELETE" }); await cargar(); location.hash = alBorrar; } catch (er) { alert(er.message); }
    };
  }

  async function verMods(slug) {
    const meta = porSlug(slug);
    if (!meta) return pintar("", null, `<div class="vacio">No existe esa página. <a href="#">Volver a las wikis</a></div>`);
    const c = cadena(meta), wiki = c[0], sec = c[1] || null;
    // Una sección sin texto propio abre directamente su primera página
    if (meta === sec && !meta.largo && hijos(sec.id).length) return location.replace("#" + hijos(sec.id)[0].slug);
    let p;
    try { p = await api(`/api/wiki/mods/${slug}`); } catch (e) { return pintar(cabeceraMods(wiki, sec), null, `<div class="vacio">${esc(e.message)}</div>`); }
    const migas = c.map((x, i) => i === c.length - 1 ? esc(x.titulo) : `<a href="#${x.slug}">${esc(x.titulo)}</a>`).join(" › ");
    if (!sec) {
      // Inicio de la wiki: sin menú lateral y con accesos a cada sección
      const secs = hijos(wiki.id);
      const accesos = secs.length ? `<h3>Secciones</h3><div class="accesos">` + secs.map(s =>
        `<a href="#${s.slug}"><strong>${esc(s.titulo)}</strong><span>${hijos(s.id).length || ""}${hijos(s.id).length ? " páginas" : ""}</span></a>`).join("") + `</div>` : "";
      pintar(cabeceraMods(wiki, null), null, articulo(p, `<a href="#">Mods</a> › ${esc(wiki.titulo)}`) + accesos);
      return activarArticulo(p, "");
    }
    let menu = (sec.largo ? `<a href="#${sec.slug}" class="${slug === sec.slug ? "sel" : ""}">${esc(sec.titulo)}</a>` : "") +
      hijos(sec.id).map(h => arbol(h, slug, 0)).join("");
    if (admin()) menu += `<a href="#nueva-en-${sec.slug}" class="mas">+ Página aquí</a>`;
    if (meta === sec && !meta.largo) {
      pintar(cabeceraMods(wiki, sec), menu, `<div class="migas">${migas}</div><h2 class="wtitulo">${esc(sec.titulo)}</h2>
        <div class="vacio">Esta sección aún no tiene páginas.${admin() ? `<br><br><a class="btn" href="#nueva-en-${sec.slug}">+ Crear la primera</a> <a class="btn g" href="#editar-${sec.slug}">Editar sección</a> <a class="btn g peligro" href="#" id="borrar">Borrar sección</a>` : ""}</div>`);
      return activarArticulo(p, "#" + wiki.slug);
    }
    pintar(cabeceraMods(wiki, sec), menu, articulo(p, migas));
    activarArticulo(p, "#" + (meta === sec ? wiki.slug : sec.slug));
  }

  async function verLore(slug) {
    let p;
    try { p = await api(`/api/wiki/lore/${slug}`); } catch (e) { return pintar(cabeceraLore(null), null, `<div class="vacio">${esc(e.message)}</div>`); }
    pintar(cabeceraLore(p.categoria), menuLore(p.categoria, slug), articulo(p, `<a href="#">Lore</a> › <a href="#cat-${p.categoria}">${nombreCat(p.categoria)}</a>`));
    activarArticulo(p, "#cat-" + p.categoria);
  }
  function categoriaLore(cat) {
    const primera = paginas.find(p => p.categoria === cat);
    if (primera) return location.replace("#" + primera.slug);
    pintar(cabeceraLore(cat), menuLore(cat, null), `<h2 class="wtitulo">${nombreCat(cat)}</h2><div class="vacio">Aún no hay páginas aquí.` +
      (puede(cat, null) ? `<br><br><a class="btn" href="#nueva-${cat}">+ Crear la primera</a>` : "") + `</div>`);
  }

  // ---------- Editor ----------
  // tipo: "wiki" | "seccion" | "pagina" (Mods) o "lore"
  function editor({ pagina, tipo, padre, categoria }) {
    const meta = pagina ? porSlug(pagina.slug) : null;
    const c = meta ? cadena(meta) : padre ? cadena(padre) : [];
    const wiki = c[0] || null, sec = c[1] || null;
    const cat = pagina ? pagina.categoria : categoria;
    const nombreTipo = { wiki: "wiki", seccion: "sección", pagina: "página", lore: "página" }[tipo];
    let campos = "";
    if (tipo === "wiki" && admin()) {
      const actual = (pagina && pagina.icono) || "sparkles";
      campos += `<label>Icono</label><div class="iconos">` + ICONOS.map(n =>
        `<label class="ico"><input type="radio" name="icono" value="${n}" ${n === actual ? "checked" : ""}>${icono(n)}</label>`).join("") + `</div>`;
    }
    if (tipo === "pagina" && pagina && admin() && wiki) {
      const secs = hijos(wiki.id);
      campos += `<label for="padre">Sección</label><select id="padre">` +
        secs.map(s => `<option value="${s.id}" ${pagina.padre_id === s.id ? "selected" : ""}>${esc(s.titulo)}</option>`).join("") +
        (pagina.padre_id && !secs.some(s => s.id === pagina.padre_id) ? `<option value="${pagina.padre_id}" selected>${esc(porId(pagina.padre_id)?.titulo || "")}</option>` : "") + `</select>`;
    }
    const opciones = admin() ? `<details class="mas-opc"><summary>Más opciones</summary><label for="orden">Posición (0 = la primera)</label>
      <input id="orden" type="number" value="${pagina ? pagina.orden : (padre ? hijos(padre.id).length : 0)}"></details>` : "";
    const ayudaTipo = tipo === "seccion" ? `<p class="fecha">Una sección es una pestaña de la wiki. El texto es opcional: si lo dejas vacío, la pestaña abre directamente su primera página.</p>`
      : tipo === "wiki" ? `<p class="fecha">El texto de una wiki es su página de Inicio.</p>` : "";
    const donde = tipo === "pagina" && sec ? ` en ${esc(sec.titulo)}` : tipo === "seccion" && wiki ? ` en ${esc(wiki.titulo)}` : tipo === "lore" ? ` en ${nombreCat(cat)}` : "";
    const cancelar = pagina ? "#" + pagina.slug : padre ? "#" + padre.slug : tipo === "lore" ? "#cat-" + cat : "#";
    const formHtml = `<form id="fe" class="editor">
      <h2 class="wtitulo">${pagina ? "Editar " + nombreTipo : "Nueva " + nombreTipo}${donde}</h2>${ayudaTipo}
      <label for="titulo">Título</label><input id="titulo" maxlength="80" required value="${pagina ? esc(pagina.titulo) : ""}">
      ${campos}
      <label for="contenido">Texto</label>
      <div class="barraed">
        <button type="button" data-acc="apartado">${icono("heading")} Apartado</button>
        <button type="button" data-acc="sub">${icono("h-2")} Subapartado</button>
        <button type="button" data-acc="negrita">${icono("bold")} Negrita</button>
        <button type="button" data-acc="cursiva">${icono("italic")} Cursiva</button>
        <button type="button" data-acc="lista">${icono("list")} Lista</button>
        <button type="button" data-acc="enlace">${icono("link")} Enlazar página</button>
        <button type="button" data-acc="externo">${icono("external-link")} Enlace web</button>
        <button type="button" data-acc="imagen">${icono("photo")} Imagen</button>
        <button type="button" data-acc="caja">${icono("id")} Caja de datos</button>
        <button type="button" data-acc="habilidades">${icono("layout-grid")} Habilidades</button>
        <button type="button" data-acc="tabla">${icono("table")} Tabla</button>
      </div>
      <div id="elegirPagina" class="elegir oculto"><input id="buscaPag" placeholder="Buscar página..."><div id="listaPag"></div></div>
      <div class="dosed"><textarea id="contenido" maxlength="20000" spellcheck="true">${pagina ? esc(pagina.contenido) : ""}</textarea>
        <div class="vistaed"><div class="fecha">Así se verá</div><div id="vista" class="pagina-vista"></div></div></div>
      ${opciones}
      <button type="submit" class="btn-guardar">Guardar</button> <a class="btn g" href="${cancelar}">Cancelar</a>
      <div id="errorEd" class="aviso oculto"></div></form>`;
    if (esLore) pintar(cabeceraLore(cat), menuLore(cat, pagina && pagina.slug), formHtml);
    else if (wiki) pintar(cabeceraMods(wiki, sec), null, formHtml);
    else pintar("", null, formHtml);

    const ta = document.getElementById("contenido"), vista = document.getElementById("vista");
    const refrescar = () => { vista.innerHTML = formato(ta.value, resolver).html || `<p class="fecha">Escribe a la izquierda.</p>`; };
    ta.addEventListener("input", refrescar); refrescar();

    // Lista de páginas para enlazar: las de la misma wiki (o todo el lore)
    const enlazables = esLore ? paginas : paginas.filter(p => wiki && cadena(p)[0] === wiki);
    const caja = document.getElementById("elegirPagina"), busca = document.getElementById("buscaPag"), lista = document.getElementById("listaPag");
    const pintarLista = () => {
      const q = normal(busca.value);
      const res = enlazables.filter(p => !q || normal(p.titulo).includes(q)).slice(0, 30);
      lista.innerHTML = res.length ? res.map(p => `<button type="button" data-t="${esc(p.titulo)}">${esc(p.titulo)}</button>`).join("")
        : `<p class="fecha">No hay páginas con ese nombre.</p>`;
    };
    busca.oninput = pintarLista;
    lista.onclick = e => {
      const b = e.target.closest("button[data-t]"); if (!b) return;
      const sel = seleccion(ta);
      envolver(ta, "[[" + b.dataset.t + (sel && sel !== b.dataset.t ? "|" : ""), "]]", sel && sel !== b.dataset.t ? sel : "");
      caja.classList.add("oculto");
    };

    document.querySelector(".barraed").onclick = e => {
      const b = e.target.closest("button[data-acc]"); if (!b) return;
      const acc = b.dataset.acc, sel = seleccion(ta);
      if (acc === "apartado") insertarBloque(ta, "# " + (sel || "Nuevo apartado"));
      else if (acc === "sub") insertarBloque(ta, "## " + (sel || "Subapartado"));
      else if (acc === "negrita") envolver(ta, "**", "**", "texto en negrita");
      else if (acc === "cursiva") envolver(ta, "*", "*", "texto en cursiva");
      else if (acc === "lista") insertarBloque(ta, sel ? sel.split("\n").map(l => "- " + l.replace(/^- /, "")).join("\n") : "- Primer punto\n- Segundo punto");
      else if (acc === "enlace") { caja.classList.toggle("oculto"); busca.value = ""; pintarLista(); busca.focus(); }
      else if (acc === "externo") {
        const url = prompt("Pega el enlace (debe empezar por https://)");
        if (url && /^https:\/\/\S+$/.test(url.trim())) envolver(ta, "[", "](" + url.trim() + ")", sel || "texto del enlace");
        else if (url) alert("El enlace debe empezar por https://");
      }
      else if (acc === "imagen") {
        const url = prompt("Pega el enlace de la imagen (debe empezar por https://)");
        if (url && /^https:\/\/\S+$/.test(url.trim())) insertarBloque(ta, `![${sel || "imagen"}](${url.trim()})`);
        else if (url) alert("El enlace debe empezar por https://");
      }
      else insertarBloque(ta, PLANTILLAS[acc]);
    };

    document.getElementById("fe").onsubmit = async ev => {
      ev.preventDefault();
      const cuerpo = { titulo: document.getElementById("titulo").value, contenido: ta.value };
      if (pagina) cuerpo.id = pagina.id;
      else { cuerpo.seccion = seccion; cuerpo.categoria = esLore ? cat : ""; if (padre) cuerpo.padre_id = padre.id; }
      const ico = document.querySelector("input[name=icono]:checked"); if (ico) cuerpo.icono = ico.value;
      const pa = document.getElementById("padre"); if (pa) cuerpo.padre_id = Number(pa.value);
      const or = document.getElementById("orden"); if (or) cuerpo.orden = Number(or.value) || 0;
      try { const r = await api("/api/wiki", { method: "POST", body: JSON.stringify(cuerpo) }); await cargar(); location.hash = r.slug; await ruta(); }
      catch (er) { const e = document.getElementById("errorEd"); e.textContent = er.message; e.classList.remove("oculto"); }
    };
  }

  // ---------- Direcciones (#...) ----------
  async function ruta() {
    const h = decodeURIComponent(location.hash.slice(1));
    let m;
    window.scrollTo(0, 0);
    if ((m = h.match(/^editar-([a-z0-9-]+)$/))) {
      try {
        const p = await api(`/api/wiki/${seccion}/${m[1]}`);
        if (puede(p.categoria, p)) {
          const meta = porSlug(p.slug), nivel = meta ? cadena(meta).length : 1;
          return editor({ pagina: p, tipo: esLore ? "lore" : nivel === 1 ? "wiki" : nivel === 2 ? "seccion" : "pagina" });
        }
      } catch {}
      return location.replace("#" + m[1]);
    }
    if (esLore) {
      if ((m = h.match(/^nueva-(\w+)$/)) && puede(m[1], null)) return editor({ tipo: "lore", categoria: m[1] });
      if ((m = h.match(/^cat-(\w+)$/))) return categoriaLore(m[1]);
      if (h) return verLore(h);
      return categoriaLore(CATEGORIAS_LORE[0][0]);
    }
    if (h === "nueva" && admin()) return editor({ tipo: "wiki" });
    if ((m = h.match(/^nueva-seccion-([a-z0-9-]+)$/)) && admin() && porSlug(m[1])) return editor({ tipo: "seccion", padre: porSlug(m[1]) });
    if ((m = h.match(/^nueva-en-([a-z0-9-]+)$/)) && admin() && porSlug(m[1])) return editor({ tipo: "pagina", padre: porSlug(m[1]) });
    if (h) return verMods(h);
    portada();
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
