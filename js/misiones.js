// Misiones: página (Inicio · Misiones personales · Misiones globales · Encargos) y pestaña «Misiones» de Administración.
// Habla con la API en /api/misiones (ver api/src/misiones.js). Va después de app.js.
const MI_TIPOS = { personal: "Personal", global: "Global", encargo: "Encargo" };
const MI_ICO = { personal: "ti-user-star", global: "ti-world", encargo: "ti-clipboard-list" };
const MI_PESTANAS = [["inicio", "Inicio"], ["personales", "Misiones personales"], ["globales", "Misiones globales"], ["encargos", "Encargos"]];
const miMonedas = n => Number(n).toLocaleString("es-ES") + " monedas";

// En un encargo con dos precios se ve «80 – 120»: completado – satisfactorio.
const miDosPrecios = m => m.tipo === "encargo" && m.monedas_min < m.monedas;

// Una fila: a la izquierda el talón con la recompensa (monedas en grande y objetos, que se entregan en el juego);
// en el centro título con su estado, descripción y tipo; a la derecha los botones, uno encima de otro.
function filaMision(m, o) {
  const n = x => Number(x).toLocaleString("es-ES");
  return `<div class="fila-m t-${m.tipo} ${o.apagada ? "apagada" : ""}"><div class="talon">
      ${m.monedas ? `<span class="num">${miDosPrecios(m) ? n(m.monedas_min) + " – " : ""}${n(m.monedas)}</span><span class="uni">monedas</span>` : `<i class="ti ti-package solo"></i>`}
      ${m.objetos.map(x => `<span class="ob"><i class="ti ti-package"></i> ${esc(x)}</span>`).join("")}</div>
    <div class="txt"><h3>${esc(m.titulo)} ${o.estado || ""}</h3>${m.descripcion ? `<p>${esc(m.descripcion)}</p>` : ""}
      <div class="de"><span class="tipo-m">${MI_TIPOS[m.tipo]}</span>${o.de || ""}</div></div>
    <div class="botones">${o.botones || ""}</div></div>`;
}
const miEstado = (clase, t) => `<span class="estado ${clase}">${t}</span>`;
const miPapelera = (id, titulo) => `<a class="papelera" href="#" data-mi="borrar" data-id="${id}" title="${titulo}"><i class="ti ti-trash"></i></a>`;
const miBoton = (accion, id, t, sec) => `<button type="button" ${sec ? 'class="sec"' : ""} data-mi="${accion}" data-id="${id}">${t}</button>`;

function ventanaMi(html) {
  const fondo = document.createElement("div");
  fondo.className = "fondo-fuera con-scroll";
  fondo.innerHTML = `<div class="aviso-fuera ventana-mision">${html}</div>`;
  document.body.appendChild(fondo);
  fondo.onclick = e => { if (e.target === fondo) fondo.remove(); };
  fondo.querySelectorAll("[data-cerrar]").forEach(b => b.onclick = e => { e.preventDefault(); fondo.remove(); });
  return fondo;
}

// Formulario para crear una misión o un encargo. «fijo» son los datos que no elige quien escribe (tipo, jugador…).
// Orden: título, precio, descripción y objetos (cada objeto en su fila, con cantidad y nombre).
// Sin textos de ayuda: en los formularios solo se marca lo que es «(opcional)».
function formMision(titulo, fijo, alGuardar) {
  const filaObjeto = () => `<div class="obj-m"><input name="o_cant" type="number" min="1" value="1" aria-label="Cantidad"><span>×</span>
    <input name="o_nombre" maxlength="50" aria-label="Objeto"><a class="papelera" href="#" data-quitar-obj title="Quitar objeto"><i class="ti ti-trash"></i></a></div>`;
  const v = ventanaMi(`<form class="form-mision"><h2>${titulo}</h2>
    <label>Título</label><input name="titulo" required maxlength="80">
    ${fijo.tipo === "encargo" ? `<div class="horas"><div><label>Precio completado</label><input name="monedas_min" type="number" min="0"></div>
      <div><label>Precio satisfactorio</label><input name="monedas" type="number" min="0"></div></div>`
    : `<label>Monedas <small>(opcional)</small></label><input name="monedas" type="number" min="0">`}
    <label>Descripción <small>(opcional)</small></label><textarea name="descripcion" class="corto" maxlength="600"></textarea>
    <label>Objetos <small>(opcional)</small></label><div id="objsM"></div>
    <button type="button" class="mas-obj" id="masObjM"><i class="ti ti-plus"></i> Añadir objeto</button>
    <div class="aviso oculto"></div>
    <button type="submit">Publicar</button> <a class="btn g" href="#" data-cerrar>Cancelar</a></form>`);
  const f = v.querySelector("form"), objs = v.querySelector("#objsM");
  v.querySelector("#masObjM").onclick = () => { objs.insertAdjacentHTML("beforeend", filaObjeto()); objs.lastElementChild.querySelector("[name=o_nombre]").focus(); };
  objs.onclick = e => { const q = e.target.closest("[data-quitar-obj]"); if (q) { e.preventDefault(); q.closest(".obj-m").remove(); } };
  f.onsubmit = async e => {
    e.preventDefault();
    const b = f.querySelector("button[type=submit]"); b.disabled = true;
    const d = Object.fromEntries(new FormData(f));
    const objetos = [...objs.querySelectorAll(".obj-m")].map(o => [o.querySelector("[name=o_cant]").value, o.querySelector("[name=o_nombre]").value.trim()])
      .filter(([, n]) => n).map(([c, n]) => `${Math.max(1, Number(c) || 1)}× ${n}`);
    try {
      // Encargo: si solo se rellena un precio, los dos son el mismo.
      const min = Number(d.monedas_min || 0), max = Number(d.monedas || 0) || min;
      await api("/api/misiones", { method: "POST", body: JSON.stringify({ ...fijo, titulo: d.titulo, descripcion: d.descripcion, monedas: max,
        monedas_min: fijo.tipo === "encargo" ? (d.monedas_min === "" ? max : min) : undefined, objetos }) });
      v.remove(); alGuardar();
    } catch (er) { const a = v.querySelector(".aviso"); a.textContent = er.message; a.classList.remove("oculto"); b.disabled = false; }
  };
  f.titulo.focus();
}

async function miSaldo() {
  try { const yo = await api("/api/yo"); const s = document.querySelector("#usuario .saldo"); if (s) s.textContent = yo.saldo + " monedas"; } catch {}
}

// Botones de las filas (los mismos en la página y en Administración). Cada uno pregunta antes si hace falta.
// Aprobar un encargo: se elige qué precio se paga (completado o satisfactorio) y, quien lo creó, puede dar dinero extra.
function ventanaPago(m, u, hecho) {
  const creador = !m.de_admin && u && m.autor_id === u.id, dos = miDosPrecios(m);
  const v = ventanaMi(`<form class="form-mision"><h2>Pagar el encargo</h2>
    <p class="ayuda centro">«${esc(m.titulo)}» · ${esc(m.usuario || "?")}</p>
    ${dos ? `<label class="opcion-pago"><input type="radio" name="pago" value="minimo" required><span><b>Completado</b><em>${miMonedas(m.monedas_min)}</em></span></label>
      <label class="opcion-pago"><input type="radio" name="pago" value="satisfactorio" required><span><b>Satisfactorio</b><em>${miMonedas(m.monedas)}</em></span></label>`
      : `<p class="precio-grande">${miMonedas(m.monedas)}</p>`}
    ${creador ? `<label>Dinero extra <small>(opcional)</small></label><input name="extra" type="number" min="0">` : ""}
    <p class="total-anuncio" id="totalPago"></p><div class="aviso oculto"></div>
    <button type="submit">Pagar</button> <a class="btn g" href="#" data-cerrar>Cancelar</a></form>`);
  const f = v.querySelector("form");
  const total = () => {
    const pago = dos ? (f.pago.value || null) : "satisfactorio", extra = Number(f.extra ? f.extra.value || 0 : 0);
    v.querySelector("#totalPago").textContent = pago ? `${m.usuario || "?"} recibe ${miMonedas((pago === "minimo" ? m.monedas_min : m.monedas) + extra)}` : "";
    return { pago, extra };
  };
  f.oninput = total; total();
  f.onsubmit = async e => {
    e.preventDefault();
    const b = f.querySelector("button[type=submit]"); b.disabled = true;
    try { await api(`/api/misiones/${m.id}/aprobar`, { method: "POST", body: JSON.stringify(total()) }); v.remove(); hecho(); }
    catch (er) { const a = v.querySelector(".aviso"); a.textContent = er.message; a.classList.remove("oculto"); b.disabled = false; }
  };
}

function enlazarMisiones(raiz, buscar, hecho, u) {
  const PREGUNTA = {
    abandonar: m => m.tipo === "personal" ? `¿Rechazar «${m.titulo}»? Desaparecerá y no la podrás recuperar.` : `¿Dejar «${m.titulo}»? Volverá a quedar libre para otra persona.`,
    aprobar: m => `¿Dar por hecho «${m.titulo}»?` + (m.monedas ? ` Se pagan ${miMonedas(m.monedas)} a ${m.usuario || "quien la tiene"}.` : "") + (m.objetos.length ? " Los objetos se entregan en el juego." : ""),
    borrar: m => `¿Borrar «${m.titulo}»?` + (m.tipo === "encargo" && !m.de_admin && m.monedas ? ` Se devuelven ${miMonedas(m.monedas)} a quien lo creó.` : ""),
  };
  raiz.querySelectorAll("[data-mi]").forEach(b => b.onclick = async e => {
    e.preventDefault();
    const accion = b.dataset.mi, m = buscar(Number(b.dataset.id));
    if (!m) return;
    if (accion === "aprobar" && m.tipo === "encargo" && m.monedas) { ventanaPago(m, u, hecho); return; }
    if (PREGUNTA[accion] && !confirm(PREGUNTA[accion](m))) return;
    try {
      await api(`/api/misiones/${m.id}` + (accion === "borrar" ? "" : "/" + accion), { method: accion === "borrar" ? "DELETE" : "POST" });
    } catch (er) { alert(er.message); }
    hecho();
  });
}

// Cómo ve un jugador cada misión: estado, línea pequeña y botones.
function filaJugador(m, u) {
  const mia = u && m.usuario_id === u.id, creada = u && m.tipo === "encargo" && m.autor_id === u.id;
  const o = { de: m.tipo === "encargo" ? "de " + esc(m.autor || "?") : "" };
  if (m.estado === "libre") {
    o.botones = !u ? `<button type="button" class="sec" data-entrar>Entrar para aceptar</button>`
      : creada ? miPapelera(m.id, "Borrar encargo")
      : miBoton("aceptar", m.id, "Aceptar");
    if (creada) o.estado = miEstado("", "Sin aceptar");
  } else if (mia) {
    const curso = m.estado === "curso";
    o.estado = curso ? miEstado("curso", "En curso") : miEstado("revisar", "Pendiente de revisar");
    if (curso) o.botones = miBoton("completar", m.id, "Completado") + miBoton("abandonar", m.id, m.tipo === "personal" ? "Rechazar" : "Abandonar", true);
  } else if (creada) {
    const revisar = m.estado === "revisar";
    o.estado = revisar ? miEstado("revisar", `${esc(m.usuario || "?")} dice que está hecho`) : miEstado("curso", `Lo hace ${esc(m.usuario || "?")}`);
    if (revisar) o.botones = miBoton("aprobar", m.id, "Aprobar y pagar") + miBoton("devolver", m.id, "No está hecho", true);
  } else {
    o.estado = miEstado("", `${m.tipo === "global" ? "La tiene" : "Lo hace"} ${esc(m.usuario || "otra persona")}`);
    o.apagada = true;
  }
  return filaMision(m, o);
}

// ---- Página de Misiones ----
async function paginaMisiones() {
  const caja = document.getElementById("misiones");
  const u = await SESION;
  let datos = null;
  async function cargar() {
    try { datos = await api("/api/misiones"); pintar(); }
    catch { caja.innerHTML = `<div class="vacio">No se pudieron cargar las misiones.</div>`; }
  }
  const hecho = async () => { await cargar(); miSaldo(); };

  const fila = m => filaJugador(m, u);
  const lista = (l, vacio) => l.length ? `<div class="diario">${l.map(fila).join("")}</div>` : `<div class="vacio">${vacio}</div>`;
  const entra = t => `<div class="vacio">${t}<br><br><a class="btn" href="#" data-entrar>Entrar con Discord</a></div>`;

  function pintar() {
    const h = location.hash.slice(1), sel = MI_PESTANAS.some(p => p[0] === h) ? h : "inicio";
    // Los encargos que has creado tú no salen aquí: solo se ven (y se verifican) en tu perfil.
    const ms = datos.misiones.filter(m => !(u && m.tipo === "encargo" && m.autor_id === u.id));
    const de = t => ms.filter(m => m.tipo === t);
    // Orden: primero lo libre, luego lo mío, al final lo que ya tiene otra persona.
    const peso = m => m.estado === "libre" ? 0 : u && m.usuario_id === u.id ? 1 : 2;
    const orden = l => l.slice().sort((a, b) => peso(a) - peso(b) || b.id - a.id);
    let cuerpo;
    if (sel === "inicio") {
      // Solo lo mío: mis personales y lo que tengo en curso.
      // Sin nada de eso, Inicio sale vacío. Sin contadores ni textos de explicación.
      cuerpo = !u ? entra("Entra con Discord para ver tus misiones.")
        : lista(ms.filter(m => m.usuario_id === u.id), "No tienes misiones en curso.");
    } else if (sel === "personales") {
      cuerpo = !u ? entra("Entra con Discord para ver tus misiones personales.") : lista(de("personal"), "No tienes misiones personales.");
    } else if (sel === "globales") {
      cuerpo = lista(orden(de("global")), "No hay misiones globales.");
    } else {
      cuerpo = lista(orden(de("encargo")), "No hay encargos.");
    }
    caja.innerHTML = `<div class="barra-merc"><div class="wtabs">${MI_PESTANAS.map(([id, t]) => `<a href="#${id}" class="${id === sel ? "sel" : ""}">${t}</a>`).join("")}</div>
      <div class="filtros">${u ? `<a class="btn" href="#" id="nuevoEncargo"><i class="ti ti-plus"></i> Nuevo encargo</a>` : `<a class="btn" href="#" data-entrar>Entrar con Discord</a>`}</div></div>${cuerpo}`;
    enlazarMisiones(caja, id => ms.find(m => m.id === id), hecho, u);
    caja.querySelectorAll("[data-entrar]").forEach(b => b.onclick = e => { e.preventDefault(); irALogin(); });
    const n = caja.querySelector("#nuevoEncargo");
    if (n) n.onclick = e => { e.preventDefault();
      formMision("Nuevo encargo", { tipo: "encargo" }, () => { location.href = "perfil.html"; }); };
  }
  window.onhashchange = () => { if (datos) pintar(); };
  // Lo que hacen los demás (aceptar, completar…) se ve al recargar cada 30 s, si no hay una ventana abierta.
  setInterval(() => { if (!document.querySelector(".fondo-fuera") && !document.hidden) cargar(); }, 30000);
  cargar();
}

// ---- Administración: pestaña Misiones ----
// A la izquierda: globales, encargos, por revisar y cada jugador. A la derecha, lo elegido.
async function adminMisiones(caja) {
  const u = await SESION;
  let datos = null, sel = "revisar", primera = true;
  async function cargar() {
    try { datos = await api("/api/misiones/admin"); } catch (er) { caja.innerHTML = `<div class="vacio">No se pudo cargar: ${esc(er.message)}</div>`; return; }
    if (primera) { primera = false; if (!datos.misiones.some(m => m.estado === "revisar")) sel = "globales"; }
    pintar();
  }
  const hecho = async () => { await cargar(); miSaldo(); };

  function fila(m) {
    const o = { de: m.tipo === "encargo" ? "de " + esc(m.autor || "?") + (m.de_admin && m.creador ? ` (${esc(m.creador)})` : "") : m.creador ? "la creó " + esc(m.creador) : "" };
    const quitar = miPapelera(m.id, m.tipo === "personal" ? "Quitar misión" : "Borrar");
    if (m.estado === "libre") { o.estado = miEstado("", "Libre"); o.botones = quitar; return filaMision(m, o); }
    const quien = esc(m.usuario || "?");
    if (m.estado === "revisar") {
      o.estado = miEstado("revisar", m.tipo === "personal" ? "Pendiente de revisar" : `${quien} dice que está hecha`);
      o.botones = miBoton("aprobar", m.id, "Aprobar y pagar") + miBoton("devolver", m.id, "No está hecha", true) + quitar;
    } else {
      o.estado = miEstado("curso", m.tipo === "personal" ? "En curso" : `En curso · ${quien}`);
      o.botones = miBoton("aprobar", m.id, "Dar por completada") + (m.tipo === "personal" ? "" : miBoton("abandonar", m.id, "Liberar", true)) + quitar;
    }
    return filaMision(m, o);
  }
  const lista = (l, vacio) => l.length ? `<div class="diario">${l.map(fila).join("")}</div>` : `<div class="vacio">${vacio}</div>`;

  function pintar() {
    const ms = datos.misiones, L = datos.limites;
    const activas = m => m.estado !== "libre";
    const personales = id => ms.filter(m => m.tipo === "personal" && m.usuario_id === id);
    const item = (id, ico, t, n) => `<a href="#" data-sel="${id}" class="${sel === id ? "sel" : ""}">${ico} ${t} <em>${n}</em></a>`;
    const jugador = sel.startsWith("u:") && datos.usuarios.find(p => "u:" + p.id === sel);
    let derecha;
    if (jugador) {
      const suyas = personales(jugador.id), otras = ms.filter(m => m.tipo !== "personal" && m.usuario_id === jugador.id);
      derecha = `<h2><img class="avatar" src="${avatarDe(jugador, 64)}" alt=""> ${esc(jugador.nombre)} <small>${suyas.length} de ${L.personales} misiones personales</small>
          ${suyas.length < L.personales ? `<a class="btn" href="#" data-nueva="personal"><i class="ti ti-plus"></i> Poner misión</a>` : `<small class="lleno">Tiene el máximo</small>`}</h2>
        ${lista(suyas, "No tiene misiones personales.")}
        <h2 class="sub2"><i class="ti ti-world"></i> Sus globales y encargos en curso</h2>${lista(otras, "No tiene ninguna.")}`;
    } else if (sel === "encargos") {
      derecha = `<h2><i class="ti ti-clipboard-list"></i> Encargos
        <a class="btn" href="#" data-nueva="encargo"><i class="ti ti-plus"></i> Encargo de Administración</a></h2>${lista(ms.filter(m => m.tipo === "encargo"), "No hay encargos abiertos.")}`;
    } else if (sel === "globales") {
      derecha = `<h2><i class="ti ti-world"></i> Misiones globales
        <a class="btn" href="#" data-nueva="global"><i class="ti ti-plus"></i> Nueva misión global</a></h2>${lista(ms.filter(m => m.tipo === "global"), "No hay misiones globales. Crea la primera.")}`;
    } else {
      derecha = `<h2><i class="ti ti-checkbox"></i> Por revisar</h2>
        ${lista(ms.filter(m => m.estado === "revisar"), "No hay nada pendiente de revisar.")}`;
    }
    caja.innerHTML = `<div class="adm"><div class="adm-lista">
        ${item("revisar", '<i class="ti ti-checkbox"></i>', "Por revisar", ms.filter(m => m.estado === "revisar").length)}
        ${item("globales", '<i class="ti ti-world"></i>', "Misiones globales", ms.filter(m => m.tipo === "global").length)}
        ${item("encargos", '<i class="ti ti-clipboard-list"></i>', "Encargos", ms.filter(m => m.tipo === "encargo").length)}
        <div class="sep">Jugadores</div>
        ${datos.usuarios.map(p => item("u:" + p.id, `<img class="avatar" src="${avatarDe(p, 32)}" alt="">`, esc(p.nombre), `${personales(p.id).filter(activas).length}/${L.personales}`)).join("")}
      </div><div class="adm-panel">${derecha}</div></div>`;
    caja.querySelectorAll("[data-sel]").forEach(a => a.onclick = e => { e.preventDefault(); sel = a.dataset.sel; pintar(); });
    enlazarMisiones(caja, id => ms.find(m => m.id === id), hecho, u);
    const n = caja.querySelector("[data-nueva]");
    if (n) n.onclick = e => {
      e.preventDefault();
      const t = n.dataset.nueva;
      if (t === "personal") formMision(`Misión para ${esc(jugador.nombre)}`, { tipo: "personal", usuario_id: jugador.id }, hecho);
      else if (t === "global") formMision("Nueva misión global", { tipo: "global" }, hecho);
      else formMision("Encargo de Administración", { tipo: "encargo", de_admin: true }, hecho);
    };
  }
  cargar();
}

// ---- Perfil: los encargos que has creado. Arriba, los que te toca verificar. ----
async function perfilEncargos(u) {
  const caja = document.getElementById("misEncargos");
  if (!caja) return;
  async function cargar() {
    let ms;
    try { ms = (await api("/api/misiones")).misiones.filter(m => m.tipo === "encargo" && m.autor_id === u.id); }
    catch { caja.innerHTML = `<div class="vacio">No se pudieron cargar tus encargos.</div>`; return; }
    const revisar = ms.filter(m => m.estado === "revisar"), resto = ms.filter(m => m.estado !== "revisar");
    const filas = l => `<div class="diario">${l.map(m => filaJugador(m, u)).join("")}</div>`;
    caja.innerHTML = `<div class="tarjeta mis-encargos"><h2><i class="ti ti-clipboard-list"></i> Mis encargos <a class="btn g mini" href="misiones.html#encargos">Ir a Encargos <i class="ti ti-arrow-right"></i></a></h2>
      ${revisar.length ? `<h3 class="por-verificar"><i class="ti ti-alert-circle"></i> Por verificar (${revisar.length})</h3>${filas(revisar)}` : ""}
      ${resto.length ? `<h3>Abiertos (${resto.length})</h3>${filas(resto)}` : ""}
      ${ms.length ? "" : `<div class="vacio">No tienes encargos abiertos.</div>`}</div>`;
    enlazarMisiones(caja, id => ms.find(m => m.id === id), async () => { await cargar(); miSaldo(); const b = document.querySelector(".cartel-perfil .der b"); try { const yo = await api("/api/yo"); if (b) b.textContent = Number(yo.saldo).toLocaleString("es-ES"); } catch {} }, u);
  }
  setInterval(() => { if (!document.querySelector(".fondo-fuera") && !document.hidden) cargar(); }, 30000);
  cargar();
}

if (document.getElementById("misiones")) paginaMisiones();
