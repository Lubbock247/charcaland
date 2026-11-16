// Misiones: página (Inicio · Misiones personales · Misiones globales · Encargos) y pestaña «Misiones» de Administración.
// Habla con la API en /api/misiones (ver api/src/misiones.js). Va después de app.js.
const MI_TIPOS = { personal: "Personal", global: "Global", encargo: "Encargo" };
const MI_ICO = { personal: "ti-user-star", global: "ti-world", encargo: "ti-clipboard-list" };
const MI_PESTANAS = [["inicio", "Inicio"], ["personales", "Misiones personales"], ["globales", "Misiones globales"], ["encargos", "Encargos"]];
const miMonedas = n => Number(n).toLocaleString("es-ES") + " monedas";

// Recompensa: monedas (se pagan desde la web) y objetos (se entregan en el juego).
// En un encargo con dos precios se ve «80 – 120 monedas»: completado – satisfactorio.
const miDosPrecios = m => m.tipo === "encargo" && m.monedas_min < m.monedas;
const miPremio = m => `<div class="premio">${m.monedas ? `<span class="mon" ${miDosPrecios(m) ? `title="${m.monedas_min} si está completado, ${m.monedas} si queda satisfactorio"` : ""}><i class="ti ti-coins"></i> ${miDosPrecios(m) ? Number(m.monedas_min).toLocaleString("es-ES") + " – " : ""}${miMonedas(m.monedas)}</span>` : ""}${
  m.objetos.map(o => `<span class="ob"><i class="ti ti-package"></i> ${esc(o)}</span>`).join("")}</div>`;
const miPremioTexto = m => [m.monedas ? miMonedas(m.monedas) : "", ...m.objetos].filter(Boolean).join(" + ");

// Una fila: icono, título con su estado, descripción, una línea pequeña, recompensa y botones.
function filaMision(m, o) {
  return `<div class="fila-m t-${m.tipo} ${o.apagada ? "apagada" : ""}"><div class="ico"><i class="ti ${MI_ICO[m.tipo]}"></i></div>
    <div class="txt"><h3>${esc(m.titulo)} ${o.estado || ""}</h3>${m.descripcion ? `<p>${esc(m.descripcion)}</p>` : ""}<div class="de">${o.de || ""}</div></div>
    ${miPremio(m)}<div class="botones">${o.botones || ""}</div></div>`;
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
function formMision(titulo, ayuda, fijo, alGuardar) {
  const v = ventanaMi(`<form class="form-mision"><h2>${titulo}</h2>
    <label>Título</label><input name="titulo" required maxlength="80" placeholder="Qué hay que hacer">
    <label>Descripción <small>(opcional)</small></label><textarea name="descripcion" class="corto" maxlength="600" placeholder="Detalles, dónde dejarlo, cómo demostrarlo…"></textarea>
    ${fijo.tipo === "encargo" ? `<div class="horas"><div><label>Monedas si está completado <small>(mínimo)</small></label><input name="monedas_min" type="number" min="0" placeholder="0"></div>
      <div><label>Monedas si queda satisfactorio <small>(máximo)</small></label><input name="monedas" type="number" min="0" placeholder="igual que el mínimo"></div></div>
      <label>Objetos <small>(opcional, uno por línea)</small></label><textarea name="objetos" class="mini" placeholder="3× Diamante"></textarea>`
    : `<div class="horas"><div><label>Monedas <small>(0 si no hay)</small></label><input name="monedas" type="number" min="0" value="0"></div>
      <div><label>Objetos <small>(uno por línea)</small></label><textarea name="objetos" class="mini" placeholder="3× Diamante"></textarea></div></div>`}
    <p class="ayuda">${ayuda}</p><div class="aviso oculto"></div>
    <button type="submit">Publicar</button> <a class="btn g" href="#" data-cerrar>Cancelar</a></form>`);
  const f = v.querySelector("form");
  f.onsubmit = async e => {
    e.preventDefault();
    const b = f.querySelector("button[type=submit]"); b.disabled = true;
    const d = Object.fromEntries(new FormData(f));
    try {
      // Encargo: si solo se rellena un precio, los dos son el mismo.
      const min = Number(d.monedas_min || 0), max = Number(d.monedas || 0) || min;
      await api("/api/misiones", { method: "POST", body: JSON.stringify({ ...fijo, ...d, monedas: max, monedas_min: fijo.tipo === "encargo" ? (d.monedas_min === "" ? max : min) : undefined, objetos: d.objetos.split("\n") }) });
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
  const creador = !m.de_admin && u && m.autor_id === u.id, dos = miDosPrecios(m), n = x => Number(x).toLocaleString("es-ES");
  const devuelve = m.de_admin ? "" : ` Se devuelven ${n(m.monedas - m.monedas_min)} monedas${creador ? " a tu saldo" : " a quien lo creó"}.`;
  const v = ventanaMi(`<form class="form-mision"><h2>Pagar el encargo</h2>
    <p class="ayuda centro">«${esc(m.titulo)}», hecho por ${esc(m.usuario || "?")}</p>
    ${dos ? `<label class="opcion-pago"><input type="radio" name="pago" value="minimo" required><span><b>Completado · ${miMonedas(m.monedas_min)}</b><small>Está hecho, sin más.${devuelve}</small></span></label>
      <label class="opcion-pago"><input type="radio" name="pago" value="satisfactorio" required><span><b>Satisfactorio · ${miMonedas(m.monedas)}</b><small>Ha quedado como querías: se paga el precio completo.</small></span></label>`
      : `<p class="precio-grande">${miMonedas(m.monedas)}</p>`}
    ${creador ? `<label>Dinero extra <small>(opcional, sale de tu saldo ahora)</small></label><input name="extra" type="number" min="0" placeholder="0">` : ""}
    ${m.objetos.length ? `<p class="ayuda">Los objetos (${m.objetos.map(esc).join(", ")}) se entregan en el juego.</p>` : ""}
    <p class="total-anuncio" id="totalPago"></p><div class="aviso oculto"></div>
    <button type="submit">Pagar</button> <a class="btn g" href="#" data-cerrar>Cancelar</a></form>`);
  const f = v.querySelector("form");
  const total = () => {
    const pago = dos ? (f.pago.value || null) : "satisfactorio", extra = Number(f.extra ? f.extra.value || 0 : 0);
    v.querySelector("#totalPago").textContent = pago ? `${m.usuario || "?"} recibe ${miMonedas((pago === "minimo" ? m.monedas_min : m.monedas) + extra)}` : "Elige qué precio pagas";
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
  const o = { de: MI_TIPOS[m.tipo] + (m.tipo === "encargo" ? " · de " + esc(m.autor || "?") : "") };
  if (m.estado === "libre") {
    o.botones = !u ? `<button type="button" class="sec" data-entrar>Entrar para aceptar</button>`
      : creada ? `<button type="button" class="sec" disabled>Nadie lo ha aceptado aún</button>${miPapelera(m.id, "Borrar encargo")}`
      : miBoton("aceptar", m.id, "Aceptar");
  } else if (mia) {
    const curso = m.estado === "curso";
    o.estado = curso ? miEstado("curso", "En curso") : miEstado("revisar", "Pendiente de revisar");
    o.botones = curso ? miBoton("completar", m.id, "Completado") + miBoton("abandonar", m.id, m.tipo === "personal" ? "Rechazar" : "Abandonar", true)
      : `<button type="button" class="sec" disabled>Esperando revisión…</button>`;
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
  const seccion = (ico, t, l, vacio, ver, hash) => `<div class="seccion-merc"><div class="seccion-cab"><h2><i class="ti ${ico}"></i> ${t}</h2>
    ${ver ? `<a href="#${hash}">${ver} →</a>` : ""}</div>${lista(l, vacio)}</div>`;
  const entra = t => `<div class="vacio">${t}<br><br><a class="btn" href="#" data-entrar>Entrar con Discord</a></div>`;

  function pintar() {
    const h = location.hash.slice(1), sel = MI_PESTANAS.some(p => p[0] === h) ? h : "inicio";
    const ms = datos.misiones, L = datos.limites, yo = datos.yo;
    const de = t => ms.filter(m => m.tipo === t);
    // Orden: primero lo libre, luego lo mío, al final lo que ya tiene otra persona.
    const peso = m => m.estado === "libre" ? 0 : u && (m.usuario_id === u.id || m.autor_id === u.id) ? 1 : 2;
    const orden = l => l.slice().sort((a, b) => peso(a) - peso(b) || b.id - a.id);
    let cuerpo;
    if (sel === "inicio") {
      // Lo que tengo yo en marcha y los encargos míos que esperan a que los revise.
      const mias = u ? ms.filter(m => m.usuario_id === u.id || (m.autor_id === u.id && m.estado === "revisar")) : [];
      const libres = t => de(t).filter(m => m.estado === "libre");
      cuerpo = (u ? `<div class="contadores">
          <a class="contador" href="#personales"><i class="ti ti-user-star"></i><div><b>${yo.personales} / ${L.personales}</b><span>Misiones personales</span></div></a>
          <a class="contador" href="#globales"><i class="ti ti-world"></i><div><b>${yo.globales} / ${L.globales}</b><span>Globales en curso · hoy has aceptado ${yo.globales_hoy} de ${L.globales_dia}</span></div></a>
          <a class="contador" href="#encargos"><i class="ti ti-clipboard-list"></i><div><b>${de("encargo").filter(m => m.autor_id === u.id).length}</b><span>Encargos tuyos abiertos · hoy has creado ${yo.encargos_hoy} de ${L.encargos_dia}</span></div></a></div>` +
          seccion("ti-target-arrow", "Mis misiones en curso", mias, "No tienes ninguna misión en curso. Acepta una de las de abajo.") : "") +
        seccion("ti-world", "Misiones globales libres", libres("global").slice(0, 4), "Ahora mismo no hay misiones globales libres.", "Ver todas", "globales") +
        seccion("ti-clipboard-list", "Últimos encargos", libres("encargo").slice(0, 4), "Ahora mismo no hay encargos libres.", "Ver todos", "encargos");
    } else if (sel === "personales") {
      cuerpo = !u ? entra("Entra con Discord para ver tus misiones personales.")
        : `<p class="ayuda nota-m">Te las pone un administrador. Tienes ${yo.personales} de ${L.personales}. Si rechazas una, desaparece.</p>` +
          lista(de("personal"), "No tienes misiones personales. Te las pondrá un administrador.");
    } else if (sel === "globales") {
      cuerpo = `<p class="ayuda nota-m">Cada misión global la hace una sola persona. Puedes aceptar ${L.globales_dia} al día y tener ${L.globales} a la vez${
        u ? ` (hoy llevas ${yo.globales_hoy}; tienes ${yo.globales} en curso)` : ""}.</p>` + lista(orden(de("global")), "No hay misiones globales ahora mismo.");
    } else {
      cuerpo = `<p class="ayuda nota-m">Trabajos que un jugador pide a otro. Cada encargo lo hace una sola persona; quien lo creó lo aprueba y entonces se paga${
        u ? `. Puedes tener ${L.encargos} aceptados a la vez (tienes ${yo.encargos}). Hoy has creado ${yo.encargos_hoy} de ${L.encargos_dia}` : ""}.</p>` + lista(orden(de("encargo")), "No hay encargos ahora mismo. ¡Crea el primero!");
    }
    caja.innerHTML = `<div class="barra-merc"><div class="wtabs">${MI_PESTANAS.map(([id, t]) => `<a href="#${id}" class="${id === sel ? "sel" : ""}">${t}</a>`).join("")}</div>
      <div class="filtros">${u ? `<a class="btn" href="#" id="nuevoEncargo"><i class="ti ti-plus"></i> Nuevo encargo</a>` : `<a class="btn" href="#" data-entrar>Entrar con Discord</a>`}</div></div>${cuerpo}`;
    enlazarMisiones(caja, id => ms.find(m => m.id === id), hecho, u);
    caja.querySelectorAll("[data-entrar]").forEach(b => b.onclick = e => { e.preventDefault(); irALogin(); });
    const n = caja.querySelector("#nuevoEncargo");
    if (n) n.onclick = e => { e.preventDefault();
      formMision("Nuevo encargo", "Al publicarlo se aparta de tu saldo el precio máximo. Cuando te digan que está hecho, eliges: si solo está completado pagas el mínimo y se te devuelve el resto; si te gusta, pagas el máximo, y puedes añadir dinero extra. Si lo borras antes de que alguien lo acepte, se te devuelve todo. Los objetos los entregas tú en el juego.",
        { tipo: "encargo" }, () => { location.hash = "encargos"; hecho(); }); };
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
    const o = { de: MI_TIPOS[m.tipo] };
    if (m.tipo === "encargo") o.de += " · de " + esc(m.autor || "?") + (m.de_admin && m.creador ? ` (${esc(m.creador)})` : "");
    else if (m.creador) o.de += " · la creó " + esc(m.creador);
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
      derecha = `<h2><i class="ti ti-clipboard-list"></i> Encargos <small>los de los jugadores y los de Administración</small>
        <a class="btn" href="#" data-nueva="encargo"><i class="ti ti-plus"></i> Encargo de Administración</a></h2>${lista(ms.filter(m => m.tipo === "encargo"), "No hay encargos abiertos.")}`;
    } else if (sel === "globales") {
      derecha = `<h2><i class="ti ti-world"></i> Misiones globales <small>cada una la hace una sola persona</small>
        <a class="btn" href="#" data-nueva="global"><i class="ti ti-plus"></i> Nueva misión global</a></h2>${lista(ms.filter(m => m.tipo === "global"), "No hay misiones globales. Crea la primera.")}`;
    } else {
      derecha = `<h2><i class="ti ti-checkbox"></i> Por revisar <small>los jugadores han pulsado «Completado»</small></h2>
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
      if (t === "personal") formMision(`Misión para ${esc(jugador.nombre)}`, "Solo la verá esta persona. Cuando la apruebes se le pagan las monedas; los objetos se los das en el juego.", { tipo: "personal", usuario_id: jugador.id }, hecho);
      else if (t === "global") formMision("Nueva misión global", "La verá todo el mundo y la aceptará una sola persona. Al aprobarla se pagan las monedas.", { tipo: "global" }, hecho);
      else formMision("Encargo de Administración", "Saldrá como «Administración» y no descuenta monedas a nadie: se crean al aprobarlo, con el precio (completado o satisfactorio) que elijas entonces.", { tipo: "encargo", de_admin: true }, hecho);
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
    caja.innerHTML = `<div class="tarjeta mis-encargos"><h2><i class="ti ti-clipboard-list"></i> Mis encargos <a href="misiones.html#encargos">Ir a Encargos →</a></h2>
      ${revisar.length ? `<h3 class="por-verificar"><i class="ti ti-alert-circle"></i> Por verificar (${revisar.length})</h3>${filas(revisar)}` : ""}
      ${resto.length ? `<h3>Abiertos (${resto.length})</h3>${filas(resto)}` : ""}
      ${ms.length ? "" : `<p class="ayuda">No tienes encargos abiertos. Puedes crear uno en <a href="misiones.html#encargos">Misiones</a>.</p>`}</div>`;
    enlazarMisiones(caja, id => ms.find(m => m.id === id), async () => { await cargar(); miSaldo(); const b = document.querySelector(".cartel-perfil .der b"); try { const yo = await api("/api/yo"); if (b) b.textContent = Number(yo.saldo).toLocaleString("es-ES"); } catch {} }, u);
  }
  setInterval(() => { if (!document.querySelector(".fondo-fuera") && !document.hidden) cargar(); }, 30000);
  cargar();
}

if (document.getElementById("misiones")) paginaMisiones();
