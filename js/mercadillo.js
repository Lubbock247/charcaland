// Página del mercadillo: pestañas (Todo · Vendo · Busco · Subastas), filtros y tarjetas.
// Habla con la API en /api/mercadillo (ver api/src/mercadillo.js).
const M_TIPOS = { vendo: "Vendo", busco: "Busco", subasta: "Subasta" };
const urlImagen = i => i && i.startsWith("/") ? CONFIG.api + i : i; // las subidas las sirve la API
const M_PESTANAS = [["inicio", "Inicio"], ["vendo", "Vendo"], ["busco", "Busco"], ["subasta", "Subastas"]];
const monedas = n => Number(n).toLocaleString("es-ES") + " monedas";

function quedan(fin) {
  const s = Math.max(0, Math.floor((fin - Date.now()) / 1000));
  if (!s) return "Terminando…";
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  if (d) return `${d} d ${h} h`;
  if (h) return `${h} h ${m} min`;
  return m ? `${m} min ${s % 60} s` : `${s} s`;
}
const minimaDe = a => a.puja ? a.puja + a.puja_minima : a.precio;
const numeroAnuncio = id => "#" + String(id).padStart(4, "0"); // el mismo número sale en el recibo

// Modo pruebas (solo admins): las acciones del mercadillo se hacen como «Jugador de prueba».
let MODO_PRUEBA = false;
try { MODO_PRUEBA = sessionStorage.getItem("merc_prueba") === "1"; } catch {}
const mapi = (ruta, op) => api(ruta, { ...op, headers: MODO_PRUEBA ? { "X-Como": "prueba" } : {} });

// Ventana sencilla reutilizable
function ventana(html) {
  const fondo = document.createElement("div");
  fondo.className = "fondo-fuera";
  fondo.innerHTML = `<div class="aviso-fuera ventana-merc">${html}</div>`;
  document.body.appendChild(fondo);
  fondo.onclick = e => { if (e.target === fondo) fondo.remove(); };
  fondo.querySelectorAll("[data-cerrar]").forEach(b => b.onclick = e => { e.preventDefault(); fondo.remove(); });
  return fondo;
}
function errorEn(fondo, msg) { const m = fondo.querySelector(".aviso"); m.textContent = msg; m.classList.remove("oculto"); }

// Precio, texto de debajo y botón de un anuncio (iguales en la tarjeta y en la vista detallada).
function precioYBoton(a, u) {
  const mio = u && a.autor_id === u.id;
  let precio, detalle = "", boton = "";
  if (a.tipo === "subasta") {
    precio = a.puja || a.precio;
    detalle = a.pujas ? `${a.pujas} puja${a.pujas === 1 ? "" : "s"} · gana ${esc(a.pujador || "?")}` : "Precio de salida";
    if (u && !mio) boton = a.pujador_id === u.id ? `<span class="ganando">Vas ganando</span>`
      : `<button type="button" data-pujar="${a.id}">Pujar</button>`;
  } else {
    precio = a.precio;
    if (a.tipo === "busco") detalle = "Paga quien lo busca";
    if (u && !mio && a.tipo === "vendo") boton = `<button type="button" data-comprar="${a.id}">Comprar</button>`;
    if (u && !mio && a.tipo === "busco") boton = `<button type="button" data-lotengo="${a.id}" class="${a.lo_tengo ? "hecho" : ""}">${a.lo_tengo ? "✓ Lo tengo" : "Lo tengo"}</button>`;
    if (mio && a.tipo === "busco") boton = `<button type="button" data-ofertas="${a.id}" ${a.ofertas ? "" : "disabled"}>${a.ofertas ? `Elegir (${a.ofertas})` : "Nadie aún"}</button>`;
  }
  return `<div class="pie-anuncio">
      <div><div class="precio">${monedas(precio)}</div>${detalle ? `<div class="detalle">${detalle}</div>` : ""}</div>
      ${boton}
    </div>`;
}
// Tipo, cuenta atrás de la subasta y, para su dueño, lápiz y papelera.
function cabeceraAnuncio(a, u) {
  const tocable = u && a.autor_id === u.id && !(a.tipo === "subasta" && a.pujas); // una subasta con pujas ya no se cambia ni se quita
  return `<div class="cab-anuncio"><span class="etiqueta tipo-${a.tipo}">${M_TIPOS[a.tipo]}</span>
    ${a.tipo === "subasta" ? `<span class="cuenta" data-fin="${a.fin}"><i class="ti ti-clock"></i> ${quedan(a.fin)}</span>` : ""}
    ${tocable ? `<span class="mis-botones"><a href="#" data-editar="${a.id}" title="Editar"><i class="ti ti-pencil"></i></a><a href="#" data-quitar="${a.id}" title="Quitar anuncio"><i class="ti ti-trash"></i></a></span>` : ""}
  </div>`;
}

// Tarjeta (sin imágenes): tipo, nombre, objetos, vendedor, precio y botón. Al pulsarla se abre el detalle.
function tarjetaAnuncio(a, u) {
  const MAX = 3, resto = a.objetos.length - MAX;
  const objetos = a.objetos.slice(0, MAX).map(o => `<li><span class="n">${o.cantidad}×</span><span class="o">${esc(o.nombre)}${o.encantamientos.length ? `<small>${o.encantamientos.map(esc).join(" · ")}</small>` : ""}</span></li>`).join("")
    + (resto > 0 ? `<li class="mas">y ${resto} más…</li>` : "");
  return `<div class="anuncio t-${a.tipo}" data-ver="${a.id}" title="Ver el anuncio">
    ${cabeceraAnuncio(a, u)}
    <div class="cuerpo">
      <h3>${esc(a.titulo)}</h3>
      <ul class="lista-objs">${objetos}</ul>
      <div class="quien"><img class="avatar" src="${avatarDe({ id: a.autor_id, avatar: a.autor_avatar }, 32)}" alt="">${esc(a.autor || "?")}</div>
    </div>
    ${precioYBoton(a, u)}</div>`;
}

// Historial de una subasta: cada puja (la más nueva arriba) y, al final, cómo empezó.
const horaCorta = ms => new Date(ms).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
function historialPujas(a) {
  const h = a.historial || [];
  return `<div class="historial"><h3>Pujas</h3><ol>
    ${h.map((p, i) => `<li class="${i ? "" : "gana"}"><b>${esc(p.nombre)}</b> pujó <b>${monedas(p.cantidad)}</b><span>${horaCorta(p.fecha)}</span></li>`).join("")}
    <li class="inicio">Empezó con <b>${monedas(a.precio)}</b><span>${horaCorta(a.creado)}</span></li></ol></div>`;
}

// Vista detallada: cada objeto con su imagen grande, encantamientos y precio; descripción y acciones.
function detalleAnuncio(a, u) {
  const objetos = a.objetos.map(o => `<div class="det-obj">
      <div class="det-fila">
        <span class="det-cant">${o.cantidad}×</span>
        <b class="det-nombre">${esc(o.nombre)}</b>
        ${a.tipo !== "subasta" ? `<span class="det-precio" title="${monedas(o.precio)} cada uno">${monedas(o.precio * o.cantidad)}</span>` : ""}
      </div>
      ${o.encantamientos.length ? `<div class="det-encs">Encantamientos:<ul>${o.encantamientos.map(e => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""}
      ${o.imagen ? `<a href="#" class="det-img" data-grande="${esc(urlImagen(o.imagen))}" title="Ver más grande"><img src="${esc(urlImagen(o.imagen))}" alt="" loading="lazy"></a>` : ""}
    </div>`).join("");
  return `<div class="detalle-anuncio">
    ${cabeceraAnuncio(a, u)}
    <h2>${esc(a.titulo)}</h2>
    <div class="quien"><img class="avatar" src="${avatarDe({ id: a.autor_id, avatar: a.autor_avatar }, 32)}" alt="">${esc(a.autor || "?")}</div>
    <div class="det-objs">${objetos}</div>
    ${a.descripcion ? `<p class="det-desc">${esc(a.descripcion)}</p>` : ""}
    ${precioYBoton(a, u)}
    ${a.tipo === "subasta" ? historialPujas(a) : ""}
    <a class="btn g det-cerrar" href="#" data-cerrar>Cerrar</a>
  </div>`;
}

// Reduce la imagen en el navegador (máx. 800 px, JPEG) antes de mandarla a la API.
function reducirImagen(archivo) {
  return new Promise((ok, mal) => {
    const img = new Image(), url = URL.createObjectURL(archivo);
    img.onload = () => {
      const k = Math.min(1, 800 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error("Ese archivo no es una imagen")); };
    img.src = url;
  });
}

// Formulario de anuncio: tipo, nombre (opcional), objetos con su imagen, subasta y descripción.
// Con «ed» (un anuncio) sirve para editarlo: el tipo y la duración de la subasta no se cambian.
function nuevoAnuncio(alGuardar, ed) {
  // Cada objeto en su caja, con su propia imagen.
  const caja = (o = {}) => `<div class="obj" ${o.imagen ? `data-imagen="${esc(o.imagen)}"` : ""}>
    <div class="obj-cab"><b></b><a href="#" class="quitar-obj" title="Quitar objeto"><i class="ti ti-trash"></i></a></div>
    <div class="obj-fila">
      <label class="subir-img mini" title="Imagen del objeto (opcional)"><input type="file" accept="image/*">
        <span class="sin-img ${o.imagen ? "oculto" : ""}"><i class="ti ti-photo-up"></i><small>Imagen</small></span>
        <img class="${o.imagen ? "" : "oculto"}" ${o.imagen ? `src="${esc(urlImagen(o.imagen))}"` : ""} alt="">
        <a href="#" class="quitar-img ${o.imagen ? "" : "oculto"}" title="Quitar imagen">✕</a></label>
      <div class="obj-datos">
        <div class="obj-campos">
          <div class="c-nombre"><label>Objeto</label><input name="o_nombre" maxlength="60" placeholder="Pico de diamante" required value="${esc(o.nombre || "")}"></div>
          <div class="c-cant"><label>Cantidad</label><input name="o_cant" type="number" min="1" value="${o.cantidad || 1}" required></div>
          <div class="c-precio"><label>Precio por unidad</label><input name="o_precio" type="number" min="0" placeholder="0" value="${o.precio || ""}"></div>
        </div>
        <label>Encantamientos <small>(opcional, separados por comas)</small></label>
        <input name="o_enc" placeholder="Eficiencia V, Fortuna III" value="${esc((o.encantamientos || []).join(", "))}">
      </div>
    </div>
  </div>`;
  const fondo = ventana(`<form class="form-anuncio">
    <h2>${ed ? "Editar anuncio " + numeroAnuncio(ed.id) : "Nuevo anuncio"}</h2>
    <div class="wtabs tipos-anuncio ${ed ? "fijo" : ""}">${Object.entries(M_TIPOS).map(([k, t], i) =>
      `<label><input type="radio" name="tipo" value="${k}" ${(ed ? ed.tipo === k : !i) ? "checked" : ""} ${ed && ed.tipo !== k ? "disabled" : ""}><span>${t}</span></label>`).join("")}</div>
    <label>Nombre del anuncio <small>(opcional)</small></label>
    <input name="titulo" maxlength="80" placeholder="Ponle un nombre al anuncio o se generará automáticamente">
    <div id="objs">${ed ? ed.objetos.map(o => caja(o)).join("") : caja()}</div>
    <button type="button" id="masObj" class="mas-obj"><i class="ti ti-plus"></i> Añadir otro objeto</button>
    <div id="cajaSubasta" class="oculto horas dos">
      <div><label>Precio de salida</label><input name="precio" type="number" min="1" value="10"></div>
      <div class="${ed ? "oculto" : ""}"><label>Dura</label><select name="duracion_min"><option value="60">1 hora</option><option value="360">6 horas</option>
        <option value="720">12 horas</option><option value="1440" selected>1 día</option><option value="4320">3 días</option><option value="10080">7 días</option></select></div>
    </div>
    <p class="total-anuncio" id="totalAnuncio"></p>
    <label>Descripción <small>(opcional)</small></label><textarea name="descripcion" class="corto" maxlength="1000"></textarea>
    <div class="aviso oculto"></div>
    <button type="submit">${ed ? "Guardar cambios" : "Publicar"}</button> <a class="btn g" href="#" data-cerrar>Cancelar</a>
  </form>`);
  if (ed) {
    // El nombre automático no se rellena: si lo dejas vacío, se vuelve a poner solo.
    const auto = /^Anuncio #\d+$/.test(ed.titulo) || (ed.objetos.length === 1 && ed.titulo === ed.objetos[0].nombre);
    fondo.querySelector("[name=titulo]").value = auto ? "" : ed.titulo;
    fondo.querySelector("[name=descripcion]").value = ed.descripcion || "";
    if (ed.tipo === "subasta") fondo.querySelector("[name=precio]").value = ed.precio;
  }
  fondo.classList.add("con-scroll"); // la ventana crece; se desplaza la página, no la ventana
  const f = fondo.querySelector("form"), objs = fondo.querySelector("#objs");
  const leer = () => {
    const g = n => [...f.querySelectorAll(`[name=${n}]`)].map(i => i.value);
    const ns = g("o_nombre"), cs = g("o_cant"), ps = g("o_precio"), es = g("o_enc");
    const imgs = [...f.querySelectorAll(".obj")].map(o => o.dataset.imagen || null);
    return { tipo: f.tipo.value, titulo: f.titulo.value.trim(), descripcion: f.descripcion.value,
      precio: Number(f.precio.value), duracion_min: Number(f.duracion_min.value),
      objetos: ns.map((n, i) => ({ nombre: n.trim(), cantidad: Number(cs[i]), precio: Number(ps[i] || 0), imagen: imgs[i],
        encantamientos: es[i].split(",").map(t => t.trim()).filter(Boolean) })) };
  };
  const actualizar = () => {
    const d = leer(), sub = d.tipo === "subasta", varios = d.objetos.length > 1;
    fondo.querySelector("#cajaSubasta").classList.toggle("oculto", !sub);
    f.querySelectorAll(".c-precio").forEach(c => { c.classList.toggle("oculto", sub); c.querySelector("input").required = !sub; });
    f.querySelectorAll(".obj").forEach((o, i) => {
      o.querySelector(".obj-cab b").textContent = `Objeto ${i + 1}`;
      o.querySelector(".obj-cab").classList.toggle("oculto", !varios);
    });
    const total = d.objetos.reduce((s, o) => s + (o.cantidad || 0) * (o.precio || 0), 0);
    fondo.querySelector("#totalAnuncio").textContent = sub ? "" : `Total: ${monedas(total)}`;
  };
  // Imagen de un objeto: elegir, arrastrar o pegar (se pega en el último objeto en el que se escribió)
  let ultimo = objs.firstElementChild;
  const ponerImagen = async (obj, archivo) => {
    if (!archivo) return;
    try {
      obj.dataset.imagen = await reducirImagen(archivo);
      const v = obj.querySelector(".subir-img img"); v.src = obj.dataset.imagen; v.classList.remove("oculto");
      obj.querySelector(".sin-img").classList.add("oculto"); obj.querySelector(".quitar-img").classList.remove("oculto");
    } catch (er) { errorEn(fondo, er.message); }
  };
  objs.onchange = e => { if (e.target.type === "file") ponerImagen(e.target.closest(".obj"), e.target.files[0]); };
  objs.onfocusin = e => { ultimo = e.target.closest(".obj") || ultimo; };
  objs.ondragover = e => { const z = e.target.closest(".subir-img"); if (z) { e.preventDefault(); z.classList.add("encima"); } };
  objs.ondragleave = e => { const z = e.target.closest(".subir-img"); if (z) z.classList.remove("encima"); };
  objs.ondrop = e => { const z = e.target.closest(".subir-img"); if (!z) return; e.preventDefault(); z.classList.remove("encima"); ponerImagen(z.closest(".obj"), e.dataTransfer.files[0]); };
  fondo.onpaste = e => { const a = [...e.clipboardData.files].find(x => x.type.startsWith("image/")); if (a && ultimo) ponerImagen(ultimo, a); };
  objs.onclick = e => {
    const o = e.target.closest(".obj");
    if (e.target.closest(".quitar-obj")) { e.preventDefault(); o.remove(); actualizar(); }
    if (e.target.classList.contains("quitar-img")) {
      e.preventDefault(); e.stopPropagation(); delete o.dataset.imagen; o.querySelector("input[type=file]").value = "";
      o.querySelector(".subir-img img").classList.add("oculto"); o.querySelector(".sin-img").classList.remove("oculto"); e.target.classList.add("oculto");
    }
  };
  fondo.querySelector("#masObj").onclick = () => {
    objs.insertAdjacentHTML("beforeend", caja()); actualizar(); objs.lastElementChild.querySelector("[name=o_nombre]").focus();
  };
  f.oninput = actualizar; actualizar();
  f.onsubmit = async e => {
    e.preventDefault();
    const b = f.querySelector("button[type=submit]"); b.disabled = true;
    try { await mapi("/api/mercadillo" + (ed ? "/" + ed.id : ""), { method: "POST", body: JSON.stringify(leer()) }); fondo.remove(); alGuardar(); }
    catch (er) { errorEn(fondo, er.message); b.disabled = false; }
  };
}

// Solo admins: dar (+) o quitar (−) monedas a alguien, siempre con motivo.
async function ventanaMonedas(alAcabar) {
  let gente = [];
  try { gente = await api("/api/usuarios"); } catch (er) { alert(er.message); return; }
  const v = ventana(`<form class="form-monedas"><h2>Dar o quitar monedas</h2>
    <label>Jugador</label><select name="usuario_id">${gente.map(p => `<option value="${esc(p.id)}">${esc(p.nombre)} · ${p.saldo} monedas</option>`).join("")}</select>
    <label>Cantidad <small>(negativa para quitar)</small></label><input name="cantidad" type="number" required placeholder="100 o -100">
    <label>Motivo</label><input name="motivo" required maxlength="200" placeholder="Por ejemplo: premio del evento">
    <div class="aviso oculto"></div>
    <button type="submit">Guardar</button> <a class="btn g" href="#" data-cerrar>Cancelar</a></form>`);
  v.querySelector("form").onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try { await api("/api/monedas", { method: "POST", body: JSON.stringify({ ...d, cantidad: Number(d.cantidad) }) }); v.remove(); alAcabar(); }
    catch (er) { errorEn(v, er.message); }
  };
}

async function paginaMercadillo() {
  const caja = document.getElementById("mercado");
  const real = await SESION;            // quien ha entrado de verdad
  const admin = real && real.rol === "admin";
  if (!admin) MODO_PRUEBA = false;
  let u = real;                          // con quien se actúa (en modo pruebas, el jugador de prueba)
  let items = [];
  const estado = { buscar: "", orden: "recientes" };
  async function cargar() {
    try {
      if (MODO_PRUEBA) u = await mapi("/api/yo");
      items = await mapi("/api/mercadillo");
      const escribiendo = document.activeElement && document.activeElement.id === "fBuscar"; // no perder el buscador al recargar
      pintar(); refrescarDetalle();
      if (escribiendo) { const n = caja.querySelector("#fBuscar"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
    }
    catch { caja.innerHTML = `<div class="vacio">No se pudo cargar el mercadillo.</div>`; }
  }
  // Tras pagar o cobrar, el saldo de la cabecera se pone al día.
  async function refrescarSaldo() {
    try { const yo = await mapi("/api/yo"); const s = document.querySelector("#usuario .saldo"); if (s) s.textContent = yo.saldo + " monedas" + (MODO_PRUEBA ? " (prueba)" : ""); } catch {}
  }
  const hecho = async () => { await cargar(); refrescarSaldo(); };
  if (MODO_PRUEBA) refrescarSaldo();

  // Inicio: una fila de subastas en las que ya se puja (las que acaban antes primero)
  // y dos filas con los últimos anuncios. Las filas se calculan según el ancho de la pantalla.
  function inicio() {
    const ancho = caja.clientWidth || 1000, cols = Math.max(1, Math.floor((ancho + 16) / (240 + 16)));
    const subastas = items.filter(a => a.tipo === "subasta" && a.pujas).sort((x, y) => x.fin - y.fin).slice(0, cols);
    const ultimos = items.filter(a => !subastas.includes(a)).sort((x, y) => y.id - x.id).slice(0, cols * 2);
    const seccion = (titulo, lista, ver) => lista.length ? `<div class="seccion-merc"><div class="seccion-cab"><h2>${titulo}</h2>
        ${ver ? `<a href="#${ver}">Ver todas →</a>` : ""}</div><div class="rejilla-merc">${lista.map(a => tarjetaAnuncio(a, u)).join("")}</div></div>` : "";
    return seccion('<i class="ti ti-flame"></i> Subastas activas', subastas, "subasta") +
      seccion('<i class="ti ti-clock-hour-4"></i> Últimos anuncios', ultimos) ||
      `<div class="vacio">Aún no hay anuncios.</div>`;
  }

  function pintar() {
    const h = location.hash.slice(1);
    const sel = M_PESTANAS.some(p => p[0] === h) ? h : "inicio";
    // Búsqueda por nombre del anuncio o de cualquiera de sus objetos (sin importar tildes ni mayúsculas)
    const norm = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const q = norm(estado.buscar.trim());
    let lista = items.filter(a => (sel === "inicio" || a.tipo === sel) &&
      (!q || norm(a.titulo).includes(q) || a.objetos.some(o => norm(o.nombre).includes(q))));
    const precioDe = a => a.puja || a.precio;
    const ORD = { recientes: (a, b) => b.id - a.id, antiguos: (a, b) => a.id - b.id,
      caro: (a, b) => precioDe(b) - precioDe(a), barato: (a, b) => precioDe(a) - precioDe(b) };
    lista = lista.slice().sort(ORD[estado.orden]);
    caja.innerHTML = (admin ? `<div class="barra-pruebas">
        ${interruptor("prueba", "Modo pruebas", MODO_PRUEBA, "Compras, ventas y pujas como «Jugador de prueba» (empieza con 10.000 monedas)")}
        <a class="btn g" href="#" id="btnMonedas"><i class="ti ti-coins"></i> Dar o quitar monedas</a>
        <a class="btn g" href="#" id="btnCorreo" title="Manda un recibo de ejemplo al Gmail que envía los recibos"><i class="ti ti-mail"></i> Probar correo</a></div>` : "") + `<div class="barra-merc">
        <div class="wtabs">${M_PESTANAS.map(([id, t]) => `<a href="#${id}" class="${id === sel ? "sel" : ""}">${t}</a>`).join("")}</div>
        <div class="filtros">
          <label class="buscar"><i class="ti ti-search"></i><input id="fBuscar" type="search" placeholder="Buscar objeto…" value="${esc(estado.buscar)}"></label>
          <select id="fOrden" class="${sel === "inicio" && !q ? "oculto" : ""}">${[["recientes", "Más recientes"], ["antiguos", "Más antiguos"], ["caro", "Precio: mayor"], ["barato", "Precio: menor"]].map(([k, t]) =>
            `<option value="${k}" ${k === estado.orden ? "selected" : ""}>${t}</option>`).join("")}</select>
          ${u ? `<a class="btn" href="#" id="nuevo">+ Nuevo anuncio</a>` : `<a class="btn" href="#" id="entrarM">Entrar para comprar</a>`}
        </div></div>
      <div id="resultados">${sel === "inicio" && !q ? inicio() : lista.length ? `<div class="rejilla-merc">${lista.map(a => tarjetaAnuncio(a, u)).join("")}</div>`
        : `<div class="vacio">${q ? "No hay nada con ese nombre." : "No hay anuncios aquí."}</div>`}</div>`;
    enlazar();
  }

  // Abre el detalle de un anuncio; sus botones hacen lo mismo que los de la tarjeta.
  // Detalle abierto: se vuelve a pintar cuando llegan datos nuevos (pujas de otros).
  let detalle = null;
  function verDetalle(a) {
    const v = ventana(detalleAnuncio(a, u));
    v.classList.add("con-scroll");
    v.querySelector(".ventana-merc").classList.add("ancha");
    detalle = { id: a.id, v };
    enlazarDetalle(v);
  }
  function refrescarDetalle() {
    if (!detalle || !document.body.contains(detalle.v)) { detalle = null; return; }
    const a = items.find(x => x.id === detalle.id);
    const caja = detalle.v.querySelector(".ventana-merc");
    if (!a) { caja.innerHTML = `<p>Este anuncio ya no está disponible.</p><a class="btn g" href="#" data-cerrar>Cerrar</a>`;
      caja.querySelector("[data-cerrar]").onclick = e => { e.preventDefault(); detalle.v.remove(); }; return; }
    caja.innerHTML = detalleAnuncio(a, u);
    enlazarDetalle(detalle.v);
  }
  function enlazarDetalle(v) {
    v.querySelectorAll("[data-cerrar]").forEach(b => b.onclick = e => { e.preventDefault(); v.remove(); });
    acciones(v, () => v.remove());
    v.querySelectorAll("[data-grande]").forEach(x => x.onclick = e => {
      e.preventDefault();
      const g = ventana(`<img class="img-grande" src="${x.dataset.grande}" alt="">`);
      g.querySelector(".ventana-merc").classList.add("solo-img");
      g.onclick = () => g.remove();
    });
  }

  // Botones de los anuncios (en «raiz»). «antes» se llama al pulsar uno (por ejemplo, cerrar el detalle).
  function acciones(raiz, antes) {
    const on = (sel, f) => raiz.querySelectorAll(sel).forEach(b => b.onclick = e => {
      e.preventDefault(); e.stopPropagation(); if (antes) antes();
      f(b, items.find(a => a.id == Object.values(b.dataset)[0]));
    });
    on("[data-editar]", (b, a) => nuevoAnuncio(hecho, a));
    on("[data-comprar]", (b, a) => {
      const v = ventana(`<h2>${esc(a.titulo)}</h2><p class="precio-grande">${monedas(a.precio)}</p><div class="aviso oculto"></div>
        <button type="button" id="si">Comprar</button> <a class="btn g" href="#" data-cerrar>Cancelar</a>`);
      v.querySelector("#si").onclick = async () => {
        try { await mapi(`/api/mercadillo/${a.id}/comprar`, { method: "POST" }); v.remove(); hecho(); } catch (er) { errorEn(v, er.message); }
      };
    });
    on("[data-pujar]", (b, a) => {
      const v = ventana(`<h2>${esc(a.titulo)}</h2><p class="ayuda">Puja actual: ${a.puja ? monedas(a.puja) : "ninguna"} · mínimo ${monedas(minimaDe(a))}</p>
        <input type="number" id="cuanto" min="${minimaDe(a)}" value="${minimaDe(a)}"><div class="aviso oculto"></div>
        <button type="button" id="si">Pujar</button> <a class="btn g" href="#" data-cerrar>Cancelar</a>`);
      v.querySelector("#si").onclick = async () => {
        try { await mapi(`/api/mercadillo/${a.id}/pujar`, { method: "POST", body: JSON.stringify({ cantidad: Number(v.querySelector("#cuanto").value) }) }); v.remove(); hecho(); }
        catch (er) { errorEn(v, er.message); }
      };
    });
    on("[data-lotengo]", async (b, a) => { try { await mapi(`/api/mercadillo/${a.id}/lotengo`, { method: "POST" }); cargar(); } catch (er) { alert(er.message); } });
    on("[data-ofertas]", (b, a) => {
      const v = ventana(`<h2>¿A quién se lo compras?</h2><p class="ayuda">Pagas ${monedas(a.precio)} al momento.</p>
        ${(a.lista_ofertas || []).map(p => `<div class="votante"><img class="avatar" src="${avatarDe(p, 32)}" alt="">${esc(p.nombre)}
          <button type="button" class="aceptar" data-quien="${esc(p.id)}">Aceptar</button></div>`).join("")}
        <div class="aviso oculto"></div><a class="btn g" href="#" data-cerrar>Cancelar</a>`);
      v.querySelectorAll("[data-quien]").forEach(x => x.onclick = async () => {
        try { await mapi(`/api/mercadillo/${a.id}/aceptar`, { method: "POST", body: JSON.stringify({ usuario_id: x.dataset.quien }) }); v.remove(); hecho(); }
        catch (er) { errorEn(v, er.message); }
      });
    });
    on("[data-quitar]", async (b, a) => {
      if (!confirm(`¿Quitar «${a.titulo}» del mercadillo?`)) return;
      try { await mapi(`/api/mercadillo/${a.id}`, { method: "DELETE" }); hecho(); } catch (er) { alert(er.message); }
    });
  }

  function enlazar() {
    acciones(caja);
    caja.querySelectorAll("[data-ver]").forEach(t => t.onclick = () => verDetalle(items.find(a => a.id == t.dataset.ver)));
    const b = caja.querySelector("#fBuscar");
    b.oninput = () => { estado.buscar = b.value; pintar(); const n = caja.querySelector("#fBuscar"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    caja.querySelector("#fOrden").onchange = e => { estado.orden = e.target.value; pintar(); };
    const n = caja.querySelector("#nuevo"); if (n) n.onclick = e => { e.preventDefault(); nuevoAnuncio(cargar); };
    const pr = caja.querySelector("[name=prueba]");
    if (pr) pr.onchange = () => {
      MODO_PRUEBA = pr.checked; try { sessionStorage.setItem("merc_prueba", MODO_PRUEBA ? "1" : "0"); } catch {}
      u = real; hecho();
    };
    const bm = caja.querySelector("#btnMonedas"); if (bm) bm.onclick = e => { e.preventDefault(); ventanaMonedas(refrescarSaldo); };
    const bc = caja.querySelector("#btnCorreo");
    if (bc) bc.onclick = async e => {
      e.preventDefault(); bc.textContent = "Mandando…";
      try { await api("/api/correo-prueba", { method: "POST" }); alert("Recibo de prueba enviado. Mira tu Gmail (y la carpeta de spam)."); }
      catch (er) { alert("No se pudo: " + er.message); }
      pintar();
    };
    const en = caja.querySelector("#entrarM"); if (en) en.onclick = e => { e.preventDefault(); irALogin(); };
  }

  window.onhashchange = pintar;
  let tRes; window.addEventListener("resize", () => { clearTimeout(tRes); tRes = setTimeout(() => { if (!document.querySelector(".fondo-fuera")) pintar(); }, 200); });
  // Cuenta atrás de las subastas; al llegar a 0 se recarga para ver cómo acabó.
  setInterval(() => {
    let acabada = false;
    document.querySelectorAll("[data-fin]").forEach(q => { q.innerHTML = `<i class="ti ti-clock"></i> ${quedan(+q.dataset.fin)}`; if (+q.dataset.fin <= Date.now()) acabada = true; });
    if (acabada && Date.now() - ultima > 3000) { ultima = Date.now(); cargar(); }
  }, 1000);
  // Pujas de otros: con subastas abiertas se mira cada 5 s; si no, cada 30 s.
  // No se recarga si hay una ventana abierta que no sea el detalle (comprar, pujar, nuevo anuncio…).
  let ultima = 0;
  setInterval(() => {
    const ventanas = document.querySelectorAll(".fondo-fuera").length - (detalle && document.body.contains(detalle.v) ? 1 : 0);
    const cada = items.some(a => a.tipo === "subasta") ? 5000 : 30000;
    if (!ventanas && !document.hidden && Date.now() - ultima >= cada) { ultima = Date.now(); cargar(); }
  }, 1000);
  cargar();
}
// Tienda del perfil: solo tus anuncios, en un estante. Desde aquí se editan y se quitan, pero no se crean.
const T_PESTANAS = [["todo", "Todo"], ["vendo", "Vendo"], ["busco", "Busco"], ["subasta", "Subastas"]];
function cuadroTienda(a, u) {
  const img = (a.objetos.find(o => o.imagen) || {}).imagen;
  const o = a.objetos[0] || { encantamientos: [] };
  const texto = a.tipo === "subasta" ? (a.pujas ? `${a.pujas} puja${a.pujas === 1 ? "" : "s"} · gana ${esc(a.pujador || "?")}` : "Sin pujas aún")
    : a.objetos.length > 1 ? `${a.objetos.length} objetos` : o.encantamientos.map(esc).join(", ");
  const precio = a.tipo === "subasta" && a.puja ? "Puja: " + monedas(a.puja) : monedas(a.precio);
  return `<div class="cuadro-tienda" data-ver="${a.id}" title="Ver el anuncio">
    ${cabeceraAnuncio(a, u)}
    <div class="ico">${img ? `<img src="${esc(urlImagen(img))}" alt="" loading="lazy">` : `<i class="ti ti-box"></i>`}</div>
    <h3>${esc(a.titulo)}</h3><p>${texto || "&nbsp;"}</p><span class="precio">${precio}</span></div>`;
}
async function paginaTienda(u) {
  const caja = document.getElementById("tienda"), resumen = document.getElementById("resumenTienda");
  let items = [], sel = "todo";
  async function cargar() {
    try { items = (await api("/api/mercadillo")).filter(a => a.autor_id === u.id); pintar(); }
    catch { caja.innerHTML = `<div class="vacio">No se pudo cargar tu tienda.</div>`; }
  }
  function pintar() {
    const cuenta = t => items.filter(a => t === "todo" || a.tipo === t).length;
    resumen.textContent = `${cuenta("vendo")} en venta · ${cuenta("busco")} buscando · ${cuenta("subasta")} subasta${cuenta("subasta") === 1 ? "" : "s"}`;
    const lista = items.filter(a => sel === "todo" || a.tipo === sel).sort((x, y) => y.id - x.id);
    caja.innerHTML = `<h2><i class="ti ti-building-store"></i> La tienda de ${esc(u.nombre)}</h2>
      <p class="sub">Todo lo que tienes publicado en el <a href="mercadillo.html">mercadillo</a></p>
      <div class="wtabs">${T_PESTANAS.map(([id, t]) => `<a href="#" data-pest="${id}" class="${id === sel ? "sel" : ""}">${t}<em>${cuenta(id)}</em></a>`).join("")}</div>
      <div class="estante">${lista.length ? lista.map(a => cuadroTienda(a, u)).join("")
        : `<div class="vacio">${sel === "todo" ? "Aún no tienes nada en el mercadillo." : "Nada aquí."}</div>`}</div>`;
    caja.querySelectorAll("[data-pest]").forEach(p => p.onclick = e => { e.preventDefault(); sel = p.dataset.pest; pintar(); });
    acciones(caja);
    caja.querySelectorAll("[data-ver]").forEach(t => t.onclick = () => verDetalle(items.find(a => a.id == t.dataset.ver)));
  }
  function verDetalle(a) {
    const v = ventana(detalleAnuncio(a, u));
    v.classList.add("con-scroll"); v.querySelector(".ventana-merc").classList.add("ancha");
    acciones(v, () => v.remove());
    v.querySelectorAll("[data-grande]").forEach(x => x.onclick = e => {
      e.preventDefault();
      const g = ventana(`<img class="img-grande" src="${x.dataset.grande}" alt="">`);
      g.querySelector(".ventana-merc").classList.add("solo-img"); g.onclick = () => g.remove();
    });
  }
  // Lo que puede hacer el dueño: editar, quitar y, en un «Busco», elegir a quién comprárselo.
  function acciones(raiz, antes) {
    const on = (s, f) => raiz.querySelectorAll(s).forEach(b => b.onclick = e => {
      e.preventDefault(); e.stopPropagation(); if (antes) antes();
      f(items.find(a => a.id == Object.values(b.dataset)[0]));
    });
    on("[data-editar]", a => nuevoAnuncio(cargar, a));
    on("[data-quitar]", async a => {
      if (!confirm(`¿Quitar «${a.titulo}» del mercadillo?`)) return;
      try { await api(`/api/mercadillo/${a.id}`, { method: "DELETE" }); cargar(); } catch (er) { alert(er.message); }
    });
    on("[data-ofertas]", a => {
      const v = ventana(`<h2>¿A quién se lo compras?</h2><p class="ayuda">Pagas ${monedas(a.precio)} al momento.</p>
        ${(a.lista_ofertas || []).map(p => `<div class="votante"><img class="avatar" src="${avatarDe(p, 32)}" alt="">${esc(p.nombre)}
          <button type="button" class="aceptar" data-quien="${esc(p.id)}">Aceptar</button></div>`).join("")}
        <div class="aviso oculto"></div><a class="btn g" href="#" data-cerrar>Cancelar</a>`);
      v.querySelectorAll("[data-quien]").forEach(x => x.onclick = async () => {
        try { await api(`/api/mercadillo/${a.id}/aceptar`, { method: "POST", body: JSON.stringify({ usuario_id: x.dataset.quien }) }); v.remove(); location.reload(); }
        catch (er) { errorEn(v, er.message); }
      });
    });
  }
  // Cuenta atrás de las subastas y recarga cada 30 s (si no hay ventanas abiertas).
  setInterval(() => document.querySelectorAll("[data-fin]").forEach(q => { q.innerHTML = `<i class="ti ti-clock"></i> ${quedan(+q.dataset.fin)}`; }), 1000);
  setInterval(() => { if (!document.querySelector(".fondo-fuera") && !document.hidden) cargar(); }, 30000);
  cargar();
}

// Este archivo va después de app.js. En el mercadillo pinta la página; en el perfil, app.js llama a paginaTienda.
if (document.getElementById("mercado")) paginaMercadillo();
