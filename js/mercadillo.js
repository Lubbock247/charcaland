// Página del mercadillo: pestañas (Todo · Vendo · Busco · Subastas), filtros y tarjetas.
// Habla con la API en /api/mercadillo (ver api/src/mercadillo.js).
const M_TIPOS = { vendo: "Vendo", busco: "Busco", subasta: "Subasta" };
const urlImagen = i => i && i.startsWith("/") ? CONFIG.api + i : i; // las subidas las sirve la API
const M_PESTANAS = [["todo", "Todo"], ["vendo", "Vendo"], ["busco", "Busco"], ["subasta", "Subastas"]];
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

function tarjetaAnuncio(a, u) {
  const mio = u && a.autor_id === u.id;
  const uno = a.objetos.length === 1 ? a.objetos[0] : null;
  const nombre = uno ? `${esc(uno.nombre)} <span class="cant">×${uno.cantidad}</span>` : esc(a.titulo);
  const lista = uno ? (uno.encantamientos.length ? `<div class="encs">${uno.encantamientos.map(esc).join(" · ")}</div>` : "")
    : `<ul class="objs">${a.objetos.map(o => `<li>${o.cantidad}× ${esc(o.nombre)}${o.encantamientos.length ? ` <small>(${o.encantamientos.map(esc).join(", ")})</small>` : ""}</li>`).join("")}</ul>`;
  let precio, boton = "";
  if (a.tipo === "subasta") {
    precio = `<div class="precio">${monedas(a.puja || a.precio)}</div>
      <div class="pujas">${a.pujas ? `${a.pujas} puja${a.pujas === 1 ? "" : "s"} · gana ${esc(a.pujador || "?")}` : "Precio de salida"}</div>
      <div class="quedan" data-fin="${a.fin}"><i class="ti ti-clock"></i> ${quedan(a.fin)}</div>`;
    if (u && !mio) boton = a.pujador_id === u.id ? `<span class="btn g ganando">Vas ganando</span>`
      : `<button type="button" data-pujar="${a.id}">Pujar ${monedas(minimaDe(a))}</button>`;
  } else {
    precio = `<div class="precio">${monedas(a.precio)}</div>${a.tipo === "busco" ? `<div class="pujas">Lo paga quien lo busca</div>` : ""}`;
    if (u && !mio && a.tipo === "vendo") boton = `<button type="button" data-comprar="${a.id}">Comprar</button>`;
    if (u && !mio && a.tipo === "busco") boton = `<button type="button" data-lotengo="${a.id}" class="${a.lo_tengo ? "hecho" : ""}">${a.lo_tengo ? "✓ Dijiste que lo tienes" : "Lo tengo"}</button>`;
    if (mio && a.tipo === "busco") boton = `<button type="button" data-ofertas="${a.id}" ${a.ofertas ? "" : "disabled"}>${a.ofertas ? `${a.ofertas} lo tiene${a.ofertas === 1 ? "" : "n"}: elegir` : "Nadie lo tiene aún"}</button>`;
  }
  if (mio && !(a.tipo === "subasta" && a.pujas)) boton += `<a href="#" class="quitar" data-quitar="${a.id}">Quitar anuncio</a>`;
  return `<div class="anuncio t-${a.tipo}">
    <div class="foto">${a.imagen ? `<img src="${esc(urlImagen(a.imagen))}" alt="" loading="lazy">` : `<i class="ti ti-package"></i>`}
      <span class="etiqueta tipo-${a.tipo}">${M_TIPOS[a.tipo]}</span></div>
    <div class="cuerpo">
      <h3>${nombre}</h3>${lista}
      ${a.descripcion ? `<p class="desc">${esc(a.descripcion)}</p>` : ""}
      <div class="quien"><img class="avatar" src="${avatarDe({ id: a.autor_id, avatar: a.autor_avatar }, 32)}" alt="">${esc(a.autor || "?")}</div>
      ${precio}
      <div class="acciones-anuncio">${boton}</div>
    </div></div>`;
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

// Formulario de nuevo anuncio: tipo, nombre (opcional), objetos con su imagen, subasta y descripción.
function nuevoAnuncio(alGuardar) {
  // Cada objeto en su caja, con su propia imagen.
  const caja = () => `<div class="obj">
    <div class="obj-cab"><b></b><a href="#" class="quitar-obj" title="Quitar objeto"><i class="ti ti-trash"></i></a></div>
    <div class="obj-fila">
      <label class="subir-img mini" title="Imagen del objeto (opcional)"><input type="file" accept="image/*">
        <span class="sin-img"><i class="ti ti-photo-up"></i><small>Imagen</small></span><img class="oculto" alt="">
        <a href="#" class="quitar-img oculto" title="Quitar imagen">✕</a></label>
      <div class="obj-datos">
        <div class="obj-campos">
          <div class="c-nombre"><label>Objeto</label><input name="o_nombre" maxlength="60" placeholder="Pico de diamante" required></div>
          <div class="c-cant"><label>Cantidad</label><input name="o_cant" type="number" min="1" value="1" required></div>
          <div class="c-precio"><label>Precio por unidad</label><input name="o_precio" type="number" min="0" placeholder="0"></div>
        </div>
        <label>Encantamientos <small>(opcional, separados por comas)</small></label>
        <input name="o_enc" placeholder="Eficiencia V, Fortuna III">
      </div>
    </div>
  </div>`;
  const fondo = ventana(`<form class="form-anuncio">
    <h2>Nuevo anuncio</h2>
    <div class="wtabs tipos-anuncio">${Object.entries(M_TIPOS).map(([k, t], i) =>
      `<label><input type="radio" name="tipo" value="${k}" ${i ? "" : "checked"}><span>${t}</span></label>`).join("")}</div>
    <label>Nombre del anuncio <small>(opcional)</small></label>
    <input name="titulo" maxlength="80" placeholder="Ponle un nombre al anuncio o se generará automáticamente">
    <div id="objs">${caja()}</div>
    <button type="button" id="masObj" class="mas-obj"><i class="ti ti-plus"></i> Añadir otro objeto</button>
    <div id="cajaSubasta" class="oculto horas dos">
      <div><label>Precio de salida</label><input name="precio" type="number" min="1" value="10"></div>
      <div><label>Dura</label><select name="duracion_min"><option value="60">1 hora</option><option value="360">6 horas</option>
        <option value="720">12 horas</option><option value="1440" selected>1 día</option><option value="4320">3 días</option><option value="10080">7 días</option></select></div>
    </div>
    <p class="total-anuncio" id="totalAnuncio"></p>
    <label>Descripción <small>(opcional)</small></label><textarea name="descripcion" class="corto" maxlength="1000"></textarea>
    <div class="aviso oculto"></div>
    <button type="submit">Publicar</button> <a class="btn g" href="#" data-cerrar>Cancelar</a>
  </form>`);
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
    try { await api("/api/mercadillo", { method: "POST", body: JSON.stringify(leer()) }); fondo.remove(); alGuardar(); }
    catch (er) { errorEn(fondo, er.message); b.disabled = false; }
  };
}

async function paginaMercadillo() {
  const caja = document.getElementById("mercado");
  const u = await SESION;
  let items = [];
  const estado = { buscar: "", orden: "recientes" };
  async function cargar() {
    try { items = await api("/api/mercadillo"); pintar(); }
    catch { caja.innerHTML = `<div class="vacio">No se pudo cargar el mercadillo.</div>`; }
  }
  // Tras pagar o cobrar, el saldo de la cabecera se pone al día.
  async function refrescarSaldo() {
    try { const yo = await api("/api/yo"); const s = document.querySelector("#usuario .saldo"); if (s) s.textContent = yo.saldo + " monedas"; } catch {}
  }
  const hecho = async () => { await cargar(); refrescarSaldo(); };

  function pintar() {
    const h = location.hash.slice(1);
    const sel = M_PESTANAS.some(p => p[0] === h) ? h : "todo";
    // Búsqueda por nombre del anuncio o de cualquiera de sus objetos (sin importar tildes ni mayúsculas)
    const norm = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const q = norm(estado.buscar.trim());
    let lista = items.filter(a => (sel === "todo" || a.tipo === sel) &&
      (!q || norm(a.titulo).includes(q) || a.objetos.some(o => norm(o.nombre).includes(q))));
    const precioDe = a => a.puja || a.precio;
    const ORD = { recientes: (a, b) => b.id - a.id, antiguos: (a, b) => a.id - b.id,
      caro: (a, b) => precioDe(b) - precioDe(a), barato: (a, b) => precioDe(a) - precioDe(b) };
    lista = lista.slice().sort(ORD[estado.orden]);
    caja.innerHTML = `<div class="barra-merc">
        <div class="wtabs">${M_PESTANAS.map(([id, t]) => `<a href="#${id}" class="${id === sel ? "sel" : ""}">${t}</a>`).join("")}</div>
        <div class="filtros">
          <label class="buscar"><i class="ti ti-search"></i><input id="fBuscar" type="search" placeholder="Buscar objeto…" value="${esc(estado.buscar)}"></label>
          <select id="fOrden">${[["recientes", "Más recientes"], ["antiguos", "Más antiguos"], ["caro", "Precio: mayor"], ["barato", "Precio: menor"]].map(([k, t]) =>
            `<option value="${k}" ${k === estado.orden ? "selected" : ""}>${t}</option>`).join("")}</select>
          ${u ? `<a class="btn" href="#" id="nuevo">+ Nuevo anuncio</a>` : `<a class="btn" href="#" id="entrarM">Entrar para comprar</a>`}
        </div></div>
      <div id="resultados">${lista.length ? `<div class="rejilla-merc">${lista.map(a => tarjetaAnuncio(a, u)).join("")}</div>`
        : `<div class="vacio">${q ? "No hay nada con ese nombre." : "No hay anuncios aquí."}</div>`}</div>`;
    enlazar();
  }

  function enlazar() {
    const on = (sel, f) => caja.querySelectorAll(sel).forEach(b => b.onclick = e => { e.preventDefault(); f(b, items.find(a => a.id == Object.values(b.dataset)[0])); });
    const b = caja.querySelector("#fBuscar");
    b.oninput = () => { estado.buscar = b.value; pintar(); const n = caja.querySelector("#fBuscar"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    caja.querySelector("#fOrden").onchange = e => { estado.orden = e.target.value; pintar(); };
    const n = caja.querySelector("#nuevo"); if (n) n.onclick = e => { e.preventDefault(); nuevoAnuncio(cargar); };
    const en = caja.querySelector("#entrarM"); if (en) en.onclick = e => { e.preventDefault(); irALogin(); };
    on("[data-comprar]", (b, a) => {
      const v = ventana(`<h2>${esc(a.titulo)}</h2><p class="precio-grande">${monedas(a.precio)}</p><div class="aviso oculto"></div>
        <button type="button" id="si">Comprar</button> <a class="btn g" href="#" data-cerrar>Cancelar</a>`);
      v.querySelector("#si").onclick = async () => {
        try { await api(`/api/mercadillo/${a.id}/comprar`, { method: "POST" }); v.remove(); hecho(); } catch (er) { errorEn(v, er.message); }
      };
    });
    on("[data-pujar]", (b, a) => {
      const v = ventana(`<h2>${esc(a.titulo)}</h2><p class="ayuda">Puja actual: ${a.puja ? monedas(a.puja) : "ninguna"} · mínimo ${monedas(minimaDe(a))}</p>
        <input type="number" id="cuanto" min="${minimaDe(a)}" value="${minimaDe(a)}"><div class="aviso oculto"></div>
        <button type="button" id="si">Pujar</button> <a class="btn g" href="#" data-cerrar>Cancelar</a>`);
      v.querySelector("#si").onclick = async () => {
        try { await api(`/api/mercadillo/${a.id}/pujar`, { method: "POST", body: JSON.stringify({ cantidad: Number(v.querySelector("#cuanto").value) }) }); v.remove(); hecho(); }
        catch (er) { errorEn(v, er.message); }
      };
    });
    on("[data-lotengo]", async (b, a) => { try { await api(`/api/mercadillo/${a.id}/lotengo`, { method: "POST" }); cargar(); } catch (er) { alert(er.message); } });
    on("[data-ofertas]", (b, a) => {
      const v = ventana(`<h2>¿A quién se lo compras?</h2><p class="ayuda">Pagas ${monedas(a.precio)} al momento.</p>
        ${(a.lista_ofertas || []).map(p => `<div class="votante"><img class="avatar" src="${avatarDe(p, 32)}" alt="">${esc(p.nombre)}
          <button type="button" class="aceptar" data-quien="${esc(p.id)}">Aceptar</button></div>`).join("")}
        <div class="aviso oculto"></div><a class="btn g" href="#" data-cerrar>Cancelar</a>`);
      v.querySelectorAll("[data-quien]").forEach(x => x.onclick = async () => {
        try { await api(`/api/mercadillo/${a.id}/aceptar`, { method: "POST", body: JSON.stringify({ usuario_id: x.dataset.quien }) }); v.remove(); hecho(); }
        catch (er) { errorEn(v, er.message); }
      });
    });
    on("[data-quitar]", async (b, a) => {
      if (!confirm(`¿Quitar «${a.titulo}» del mercadillo?`)) return;
      try { await api(`/api/mercadillo/${a.id}`, { method: "DELETE" }); hecho(); } catch (er) { alert(er.message); }
    });
  }

  window.onhashchange = pintar;
  // Cuenta atrás de las subastas; al llegar a 0 se recarga para ver cómo acabó.
  setInterval(() => {
    let acabada = false;
    caja.querySelectorAll("[data-fin]").forEach(q => { q.innerHTML = `<i class="ti ti-clock"></i> ${quedan(+q.dataset.fin)}`; if (+q.dataset.fin <= Date.now()) acabada = true; });
    if (acabada && !document.querySelector(".fondo-fuera")) cargar();
  }, 1000);
  setInterval(() => { if (!document.querySelector(".fondo-fuera")) cargar(); }, 30000); // pujas de otros
  cargar();
}
paginaMercadillo(); // este archivo va después de app.js
