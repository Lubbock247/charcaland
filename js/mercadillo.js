// Página del mercadillo: pestañas (Todo · Vendo · Busco · Subastas), filtros y tarjetas.
// Habla con la API en /api/mercadillo (ver api/src/mercadillo.js).
const M_TIPOS = { vendo: "Vendo", busco: "Busco", subasta: "Subasta" };
const M_CATEGORIAS = { // PROVISIONAL (igual que en la API)
  bloques: ["Bloques", "ti-box"], herramientas: ["Herramientas y armas", "ti-sword"], armadura: ["Armadura", "ti-shield"],
  comida: ["Comida", "ti-meat"], mods: ["De mods", "ti-puzzle"], encantamientos: ["Encantamientos y libros", "ti-book"], otros: ["Otros", "ti-dots"],
};
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
  const [cat, icono] = M_CATEGORIAS[a.categoria] || M_CATEGORIAS.otros;
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
    <div class="foto">${a.imagen ? `<img src="${esc(a.imagen)}" alt="" loading="lazy">` : `<i class="ti ${icono}"></i>`}
      <span class="etiqueta tipo-${a.tipo}">${M_TIPOS[a.tipo]}</span></div>
    <div class="cuerpo">
      <h3>${nombre}</h3>${lista}
      ${a.descripcion ? `<p class="desc">${esc(a.descripcion)}</p>` : ""}
      <div class="quien"><img class="avatar" src="${avatarDe({ id: a.autor_id, avatar: a.autor_avatar }, 32)}" alt="">${esc(a.autor || "?")}<span>· ${cat}</span></div>
      ${precio}
      <div class="acciones-anuncio">${boton}</div>
    </div></div>`;
}

// Formulario de nuevo anuncio
function nuevoAnuncio(alGuardar) {
  const fila = () => `<div class="fila-obj">
    <input name="o_nombre" placeholder="Objeto" maxlength="60" required>
    <input name="o_cant" type="number" min="1" value="1" title="Cantidad" required>
    <input name="o_precio" type="number" min="0" placeholder="Precio/u" title="Precio por unidad" class="solo-precio">
    <input name="o_enc" placeholder="Encantamientos (separados por comas)" class="ancha">
    <a href="#" class="quitar-obj" title="Quitar">✕</a></div>`;
  const fondo = ventana(`<form class="form-anuncio">
    <h2>Nuevo anuncio</h2>
    <div class="wtabs tipos-anuncio">${Object.entries(M_TIPOS).map(([k, t], i) =>
      `<label><input type="radio" name="tipo" value="${k}" ${i ? "" : "checked"}><span>${t}</span></label>`).join("")}</div>
    <p class="ayuda" id="ayudaTipo"></p>
    <label>Categoría</label><select name="categoria">${Object.entries(M_CATEGORIAS).map(([k, [t]]) => `<option value="${k}">${t}</option>`).join("")}</select>
    <label>Objetos</label><div id="objs">${fila()}</div>
    <a href="#" id="masObj" class="mas-obj">+ Añadir otro objeto</a>
    <div id="cajaTitulo" class="oculto"><label>Nombre del anuncio</label><input name="titulo" maxlength="80" placeholder="Por ejemplo: Lote de libros"></div>
    <div id="cajaSubasta" class="oculto horas">
      <div><label>Precio de salida</label><input name="precio" type="number" min="1" value="10"></div>
      <div><label>Puja mínima</label><input name="puja_minima" type="number" min="1" value="5"></div>
      <div><label>Dura</label><select name="duracion_min"><option value="60">1 hora</option><option value="360">6 horas</option>
        <option value="720">12 horas</option><option value="1440" selected>1 día</option><option value="4320">3 días</option><option value="10080">7 días</option></select></div>
    </div>
    <p class="total-anuncio" id="totalAnuncio"></p>
    <label>Imagen (opcional)</label><input name="imagen" type="url" placeholder="https://… (enlace a una captura)">
    <label>Descripción (opcional)</label><textarea name="descripcion" class="corto" maxlength="1000"></textarea>
    <div class="aviso oculto"></div>
    <button type="submit">Publicar</button> <a class="btn g" href="#" data-cerrar>Cancelar</a>
  </form>`);
  const f = fondo.querySelector("form"), objs = fondo.querySelector("#objs");
  const AYUDA = { vendo: "Pones un precio. Quien lo compra paga al momento.", busco: "Dices qué quieres y cuánto pagas. Otros pulsan «Lo tengo» y tú eliges a quién se lo compras.",
    subasta: "Las monedas de cada puja se apartan. Si alguien puja en los últimos 30 s, se alarga 30 s más." };
  const leer = () => {
    const tipo = f.tipo.value;
    const g = n => [...f.querySelectorAll(`[name=${n}]`)].map(i => i.value);
    const ns = g("o_nombre"), cs = g("o_cant"), ps = g("o_precio"), es = g("o_enc");
    return { tipo, categoria: f.categoria.value, titulo: f.titulo.value, imagen: f.imagen.value.trim(), descripcion: f.descripcion.value,
      precio: Number(f.precio.value), puja_minima: Number(f.puja_minima.value), duracion_min: Number(f.duracion_min.value),
      objetos: ns.map((n, i) => ({ nombre: n.trim(), cantidad: Number(cs[i]), precio: Number(ps[i] || 0),
        encantamientos: es[i].split(",").map(t => t.trim()).filter(Boolean) })) };
  };
  const actualizar = () => {
    const d = leer(), sub = d.tipo === "subasta";
    fondo.querySelector("#ayudaTipo").textContent = AYUDA[d.tipo];
    fondo.querySelector("#cajaSubasta").classList.toggle("oculto", !sub);
    fondo.querySelector("#cajaTitulo").classList.toggle("oculto", d.objetos.length < 2);
    f.querySelectorAll(".solo-precio").forEach(i => { i.classList.toggle("oculto", sub); i.required = !sub; });
    f.querySelectorAll(".quitar-obj").forEach(b => b.classList.toggle("oculto", d.objetos.length < 2));
    const total = d.objetos.reduce((s, o) => s + (o.cantidad || 0) * (o.precio || 0), 0);
    fondo.querySelector("#totalAnuncio").textContent = sub ? "" : `Total: ${monedas(total)}`;
  };
  objs.onclick = e => { if (e.target.classList.contains("quitar-obj")) { e.preventDefault(); e.target.parentElement.remove(); actualizar(); } };
  fondo.querySelector("#masObj").onclick = e => { e.preventDefault(); objs.insertAdjacentHTML("beforeend", fila()); actualizar(); };
  f.oninput = actualizar; actualizar();
  f.onsubmit = async e => {
    e.preventDefault();
    try { await api("/api/mercadillo", { method: "POST", body: JSON.stringify(leer()) }); fondo.remove(); alGuardar(); }
    catch (er) { errorEn(fondo, er.message); }
  };
}

async function paginaMercadillo() {
  const caja = document.getElementById("mercado");
  const u = await SESION;
  let items = [];
  const estado = { categoria: "", orden: "recientes" };
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
    let lista = items.filter(a => (sel === "todo" || a.tipo === sel) && (!estado.categoria || a.categoria === estado.categoria));
    const ORD = { recientes: (a, b) => b.id - a.id, barato: (a, b) => (a.puja || a.precio) - (b.puja || b.precio),
      caro: (a, b) => (b.puja || b.precio) - (a.puja || a.precio), acaba: (a, b) => (a.fin || Infinity) - (b.fin || Infinity) };
    lista = lista.slice().sort(ORD[estado.orden]);
    caja.innerHTML = `<div class="barra-merc">
        <div class="wtabs">${M_PESTANAS.map(([id, t]) => `<a href="#${id}" class="${id === sel ? "sel" : ""}">${t}</a>`).join("")}</div>
        <div class="filtros">
          <select id="fCat"><option value="">Todas las categorías</option>${Object.entries(M_CATEGORIAS).map(([k, [t]]) =>
            `<option value="${k}" ${k === estado.categoria ? "selected" : ""}>${t}</option>`).join("")}</select>
          <select id="fOrden">${[["recientes", "Más recientes"], ["barato", "Más baratos"], ["caro", "Más caros"], ["acaba", "Acaban antes"]].map(([k, t]) =>
            `<option value="${k}" ${k === estado.orden ? "selected" : ""}>${t}</option>`).join("")}</select>
          ${u ? `<a class="btn" href="#" id="nuevo">+ Nuevo anuncio</a>` : `<a class="btn" href="#" id="entrarM">Entrar para comprar</a>`}
        </div></div>
      ${lista.length ? `<div class="rejilla-merc">${lista.map(a => tarjetaAnuncio(a, u)).join("")}</div>` : `<div class="vacio">No hay anuncios aquí.</div>`}`;
    enlazar();
  }

  function enlazar() {
    const on = (sel, f) => caja.querySelectorAll(sel).forEach(b => b.onclick = e => { e.preventDefault(); f(b, items.find(a => a.id == Object.values(b.dataset)[0])); });
    caja.querySelector("#fCat").onchange = e => { estado.categoria = e.target.value; pintar(); };
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
