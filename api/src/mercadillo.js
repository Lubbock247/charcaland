// Mercadillo: anuncios (Vendo, Busco, Subasta), pujas, monedas y recibos.
// Cada operación con monedas va en un solo lote (env.DB.batch), que se hace entero o nada.
// Dos triggers de la base de datos lo protegen (ver mercadillo.sql):
//   SALDO    -> alguien se quedaría en negativo
//   CAMBIADO -> el anuncio cambió entre leerlo y guardarlo (otro compró o pujó antes)
import { reciboPng } from "./recibo.js";

export const TIPOS = ["vendo", "busco", "subasta"];
export const CATEGORIAS = ["bloques", "herramientas", "armadura", "comida", "mods", "encantamientos", "otros"]; // PROVISIONAL
const NOMBRE_TIPO = { vendo: "Vendo", busco: "Busco", subasta: "Subasta" };
const PRORROGA = 30 * 1000;
const MAX_MONEDAS = 1_000_000_000;

const entero = (v, min, max) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
const texto = (v, max) => String(v ?? "").trim().slice(0, max);

// Lanza el lote y traduce los errores de los triggers a mensajes para el usuario.
async function lote(env, sentencias) {
  try { await env.DB.batch(sentencias); return null; }
  catch (e) {
    const m = String(e.message || e);
    if (m.includes("SALDO")) return [400, { error: "No hay monedas suficientes" }];
    if (m.includes("CAMBIADO")) return [409, { error: "El anuncio acaba de cambiar. Vuelve a cargar la página." }];
    throw e;
  }
}
const mov = (env, usuario, cantidad, motivo, anuncio, admin, ahora) =>
  env.DB.prepare("INSERT INTO movimientos (usuario_id, cantidad, motivo, anuncio_id, admin_id, fecha) VALUES (?1,?2,?3,?4,?5,?6)")
    .bind(usuario, cantidad, motivo, anuncio ?? null, admin ?? null, ahora);
const saldo = (env, usuario, cantidad) =>
  env.DB.prepare("UPDATE usuarios SET saldo = saldo + ?1 WHERE id = ?2").bind(cantidad, usuario);

// Líneas del recibo. En la subasta se paga el lote entero: una línea con el total
// y los objetos debajo (PROVISIONAL).
function lineasRecibo(a, total) {
  const objs = JSON.parse(a.objetos);
  if (a.tipo !== "subasta") return objs;
  return [{ nombre: a.titulo, cantidad: 1, precio: total,
    encantamientos: objs.map(o => `${o.cantidad}× ${o.nombre}` + (o.encantamientos?.length ? ` (${o.encantamientos.join(", ")})` : "")) }];
}
const recibo = (env, a, comprador, vendedor, total, ahora) =>
  env.DB.prepare("INSERT INTO recibos (anuncio_id, tipo, comprador_id, vendedor_id, total, objetos, fecha) VALUES (?1,?2,?3,?4,?5,?6,?7)")
    .bind(a.id, a.tipo, comprador, vendedor, total, JSON.stringify(lineasRecibo(a, total)), ahora);
const cerrar = (env, a, estado, comprador, ahora) =>
  env.DB.prepare("UPDATE anuncios SET estado = ?1, comprador_id = ?2, cerrado = ?3, version = ?4 WHERE id = ?5")
    .bind(estado, comprador ?? null, ahora, a.version + 1, a.id);

// ---- Leer ----
async function abierto(env, id) {
  const a = await env.DB.prepare("SELECT * FROM anuncios WHERE id = ?1").bind(Number(id)).first();
  if (!a) return [null, [404, { error: "No existe ese anuncio" }]];
  if (a.estado !== "abierto" || (a.tipo === "subasta" && a.fin <= Date.now()))
    return [null, [400, { error: "Ese anuncio ya no está disponible" }]];
  return [a, null];
}

export async function listar(env, u) {
  await cerrarSubastas(env);
  const r = await env.DB.prepare(
    `SELECT a.*, us.nombre AS autor, us.avatar AS autor_avatar, p.nombre AS pujador,
       (SELECT COUNT(*) FROM pujas WHERE anuncio_id = a.id) AS pujas,
       (SELECT COUNT(*) FROM ofertas WHERE anuncio_id = a.id) AS ofertas
     FROM anuncios a LEFT JOIN usuarios us ON us.id = a.autor_id LEFT JOIN usuarios p ON p.id = a.pujador_id
     WHERE a.estado = 'abierto' ORDER BY a.id DESC`).all();
  const lista = r.results.map(({ version, comprador_id, cerrado, ...a }) => ({ ...a, objetos: JSON.parse(a.objetos) }));
  // Historial de pujas de las subastas abiertas (la más nueva primero): quién, cuánto y cuándo.
  if (lista.some(a => a.tipo === "subasta" && a.pujas)) {
    const pj = (await env.DB.prepare(
      `SELECT p.anuncio_id, p.cantidad, p.fecha, us.nombre FROM pujas p JOIN anuncios a ON a.id = p.anuncio_id
       LEFT JOIN usuarios us ON us.id = p.usuario_id WHERE a.estado = 'abierto' AND a.tipo = 'subasta' ORDER BY p.id DESC`).all()).results;
    for (const a of lista) if (a.tipo === "subasta")
      a.historial = pj.filter(p => p.anuncio_id === a.id).map(p => ({ nombre: p.nombre || "?", cantidad: p.cantidad, fecha: p.fecha }));
  }
  if (u) {
    // A quien puso un Busco se le dice quién pulsó «Lo tengo»; a los demás, si ya lo pulsaron.
    const of = (await env.DB.prepare(
      `SELECT o.anuncio_id, o.usuario_id, us.nombre, us.avatar FROM ofertas o
       JOIN anuncios a ON a.id = o.anuncio_id LEFT JOIN usuarios us ON us.id = o.usuario_id
       WHERE a.estado = 'abierto' AND (a.autor_id = ?1 OR o.usuario_id = ?1) ORDER BY o.fecha`).bind(u.id).all()).results;
    for (const a of lista) {
      const mias = of.filter(o => o.anuncio_id === a.id);
      if (a.autor_id === u.id) a.lista_ofertas = mias.map(o => ({ id: o.usuario_id, nombre: o.nombre, avatar: o.avatar }));
      else a.lo_tengo = mias.some(o => o.usuario_id === u.id);
    }
  }
  return lista;
}

// ---- Crear y quitar ----
// Número de anuncio: es su id con 4 cifras. El recibo de ese anuncio lleva el mismo número.
export const numeroAnuncio = id => "#" + String(id).padStart(4, "0");

// Imagen de un objeto: una nueva (data URL ya reducida en el navegador) o una ya guardada ("/api/imagen/N").
function leerImagenSubida(v) {
  if (!v) return [null, null];
  if (/^\/api\/imagen\/\d+$/.test(String(v))) return [{ ya: String(v) }, null];
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(v));
  if (!m) return [null, "Una de las imágenes no es válida"];
  if (m[2].length > 700000) return [null, "Una de las imágenes es demasiado grande"];
  return [{ tipo: m[1], b64: m[2] }, null];
}

function leerObjetos(d, conPrecio) {
  if (!Array.isArray(d.objetos) || !d.objetos.length || d.objetos.length > 20) return [null, "Revisa los objetos: cada uno necesita nombre, cantidad y precio"];
  const objs = [];
  for (const o of d.objetos) {
    const nombre = texto(o && o.nombre, 60), cantidad = entero(o && o.cantidad, 1, 100000);
    const precio = conPrecio ? entero(o && o.precio, 0, MAX_MONEDAS) : 0;
    if (!nombre || cantidad === null || precio === null) return [null, "Revisa los objetos: cada uno necesita nombre, cantidad y precio"];
    const enc = Array.isArray(o.encantamientos) ? o.encantamientos.map(e => texto(e, 40)).filter(Boolean).slice(0, 15) : [];
    const [img, err] = leerImagenSubida(o.imagen);
    if (err) return [null, err];
    objs.push({ nombre, cantidad, precio, encantamientos: enc, img });
  }
  return [objs, null];
}

// Guarda las imágenes nuevas y deja en cada objeto solo su dirección.
async function guardarImagenes(env, u, objetos, ahora) {
  for (const o of objetos) {
    if (o.img && o.img.ya) o.imagen = o.img.ya;
    else if (o.img) {
      const bin = Uint8Array.from(atob(o.img.b64), c => c.charCodeAt(0));
      const ri = await env.DB.prepare("INSERT INTO imagenes (tipo, datos, autor_id, creado) VALUES (?1,?2,?3,?4)")
        .bind(o.img.tipo, bin.buffer, u.id, ahora).run();
      o.imagen = "/api/imagen/" + ri.meta.last_row_id;
    }
    delete o.img;
  }
  return (objetos.find(o => o.imagen) || {}).imagen || null; // la de la tarjeta: la del primer objeto que tenga
}

// Lo que comparten crear y editar: objetos, precio, subasta y nombre.
function leerAnuncio(d, tipo) {
  const [objetos, errObj] = leerObjetos(d, tipo !== "subasta");
  if (errObj) return [null, errObj];
  const r = { objetos, descripcion: texto(d.descripcion, 1000), titulo: texto(d.titulo, 80) };
  if (tipo === "subasta") {
    r.precio = entero(d.precio, 1, MAX_MONEDAS);
    if (r.precio === null) return [null, "Falta el precio de salida"];
  } else {
    r.precio = objetos.reduce((s, o) => s + o.cantidad * o.precio, 0);
    if (r.precio < 1 || r.precio > MAX_MONEDAS) return [null, "El precio total tiene que ser de al menos 1 moneda"];
  }
  // Sin nombre: con un objeto, el del objeto; con varios, «Anuncio #0001» (se pone al saber el número).
  if (!r.titulo && objetos.length === 1) r.titulo = objetos[0].nombre;
  return [r, null];
}

export async function crear(env, u, d) {
  const tipo = TIPOS.includes(d.tipo) ? d.tipo : null;
  if (!tipo) return [400, { error: "Tipo de anuncio no válido" }];
  const [a, err] = leerAnuncio(d, tipo);
  if (err) return [400, { error: err }];
  const ahora = Date.now();
  let fin = null; // puja mínima: siempre 1 moneda más que la anterior
  if (tipo === "subasta") {
    const dur = entero(d.duracion_min, 1, 7 * 24 * 60); // duración en minutos (hasta 7 días)
    if (dur === null) return [400, { error: "Duración no válida" }];
    fin = ahora + dur * 60000;
  }
  const abiertos = await env.DB.prepare("SELECT COUNT(*) AS n FROM anuncios WHERE autor_id = ?1 AND estado = 'abierto'").bind(u.id).first();
  if (abiertos.n >= 30) return [400, { error: "Tienes demasiados anuncios abiertos (30)" }];
  const imagen = await guardarImagenes(env, u, a.objetos, ahora);
  const r = await env.DB.prepare(
    "INSERT INTO anuncios (tipo, autor_id, titulo, categoria, imagen, descripcion, objetos, precio, puja_minima, fin, creado) VALUES (?1,?2,?3,'otros',?4,?5,?6,?7,1,?8,?9)"
  ).bind(tipo, u.id, a.titulo, imagen, a.descripcion, JSON.stringify(a.objetos), a.precio, fin, ahora).run();
  const id = r.meta.last_row_id;
  if (!a.titulo) await env.DB.prepare("UPDATE anuncios SET titulo = ?1, version = 1 WHERE id = ?2").bind("Anuncio " + numeroAnuncio(id), id).run();
  return [201, { id }];
}

// Editar: solo quien lo puso (o un admin), mientras siga abierto. Una subasta con pujas ya no se cambia.
// El tipo no se cambia; en la subasta tampoco la hora de fin.
export async function editar(env, u, id, d) {
  const [a, err] = await abierto(env, id);
  if (err) return err;
  if (a.autor_id !== u.id && u.rol !== "admin") return [403, { error: "No es tu anuncio" }];
  if (a.tipo === "subasta" && a.pujador_id) return [400, { error: "La subasta ya tiene pujas: no se puede cambiar" }];
  const [n, e2] = leerAnuncio(d, a.tipo);
  if (e2) return [400, { error: e2 }];
  const imagen = await guardarImagenes(env, u, n.objetos, Date.now());
  const titulo = n.titulo || "Anuncio " + numeroAnuncio(a.id);
  const e3 = await lote(env, [env.DB.prepare(
    "UPDATE anuncios SET titulo = ?1, imagen = ?2, descripcion = ?3, objetos = ?4, precio = ?5, version = ?6 WHERE id = ?7"
  ).bind(titulo, imagen, n.descripcion, JSON.stringify(n.objetos), n.precio, a.version + 1, a.id)]);
  return e3 || [200, { ok: true }];
}

export async function quitar(env, u, id) {
  const [a, err] = await abierto(env, id);
  if (err) return err;
  const admin = u.rol === "admin";
  if (a.autor_id !== u.id && !admin) return [403, { error: "No es tu anuncio" }];
  if (a.pujador_id && !admin) return [400, { error: "La subasta ya tiene pujas: no se puede quitar" }];
  const ahora = Date.now(), s = [cerrar(env, a, "quitado", null, ahora)];
  if (a.pujador_id) s.push(saldo(env, a.pujador_id, a.puja),
    mov(env, a.pujador_id, a.puja, `Devolución: subasta «${a.titulo}» quitada`, a.id, u.id, ahora));
  return (await lote(env, s)) || [200, { ok: true }];
}

// ---- Vendo: comprar ----
export async function comprar(env, u, id) {
  const [a, err] = await abierto(env, id);
  if (err) return err;
  if (a.tipo !== "vendo") return [400, { error: "Este anuncio no se compra así" }];
  if (a.autor_id === u.id) return [400, { error: "Es tu propio anuncio" }];
  const ahora = Date.now();
  const e = await lote(env, [
    cerrar(env, a, "vendido", u.id, ahora),
    saldo(env, u.id, -a.precio), mov(env, u.id, -a.precio, `Compra: «${a.titulo}»`, a.id, null, ahora),
    saldo(env, a.autor_id, a.precio), mov(env, a.autor_id, a.precio, `Venta: «${a.titulo}»`, a.id, null, ahora),
    recibo(env, a, u.id, a.autor_id, a.precio, ahora),
  ]);
  return e || [200, { ok: true, recibo: await numeroRecibo(env, a.id) }];
}

// ---- Busco: «Lo tengo» y «Aceptar» ----
export async function loTengo(env, u, id) {
  const [a, err] = await abierto(env, id);
  if (err) return err;
  if (a.tipo !== "busco") return [400, { error: "Esto solo vale en anuncios de Busco" }];
  if (a.autor_id === u.id) return [400, { error: "Es tu propio anuncio" }];
  const ya = await env.DB.prepare("SELECT 1 FROM ofertas WHERE anuncio_id = ?1 AND usuario_id = ?2").bind(a.id, u.id).first();
  if (ya) await env.DB.prepare("DELETE FROM ofertas WHERE anuncio_id = ?1 AND usuario_id = ?2").bind(a.id, u.id).run();
  else await env.DB.prepare("INSERT INTO ofertas (anuncio_id, usuario_id, fecha) VALUES (?1,?2,?3)").bind(a.id, u.id, Date.now()).run();
  return [200, { lo_tengo: !ya }];
}

export async function aceptar(env, u, id, d) {
  const [a, err] = await abierto(env, id);
  if (err) return err;
  if (a.tipo !== "busco") return [400, { error: "Esto solo vale en anuncios de Busco" }];
  if (a.autor_id !== u.id) return [403, { error: "No es tu anuncio" }];
  const vendedor = String(d.usuario_id || "");
  const of = await env.DB.prepare("SELECT 1 FROM ofertas WHERE anuncio_id = ?1 AND usuario_id = ?2").bind(a.id, vendedor).first();
  if (!of) return [400, { error: "Esa persona no ha dicho que lo tenga" }];
  const ahora = Date.now();
  const e = await lote(env, [
    cerrar(env, a, "vendido", u.id, ahora),
    saldo(env, u.id, -a.precio), mov(env, u.id, -a.precio, `Compra (Busco): «${a.titulo}»`, a.id, null, ahora),
    saldo(env, vendedor, a.precio), mov(env, vendedor, a.precio, `Venta (Busco): «${a.titulo}»`, a.id, null, ahora),
    recibo(env, a, u.id, vendedor, a.precio, ahora),
  ]);
  return e || [200, { ok: true, recibo: await numeroRecibo(env, a.id) }];
}

// ---- Subasta: pujar ----
// Al pujar se apartan tus monedas y se devuelven las del anterior.
// Si quedan 30 s o menos, el fin pasa a 30 s después de esta puja.
export async function pujar(env, u, id, d) {
  const [a, err] = await abierto(env, id);
  if (err) return err;
  if (a.tipo !== "subasta") return [400, { error: "Este anuncio no es una subasta" }];
  if (a.autor_id === u.id) return [400, { error: "Es tu propia subasta" }];
  if (a.pujador_id === u.id) return [400, { error: "Ya vas ganando" }];
  const minimo = a.puja ? a.puja + a.puja_minima : a.precio;
  const cantidad = d.cantidad === undefined ? minimo : entero(d.cantidad, 1, MAX_MONEDAS);
  if (cantidad === null || cantidad < minimo) return [400, { error: `La puja tiene que ser de al menos ${minimo}`, minimo }];
  const ahora = Date.now();
  const fin = a.fin - ahora <= PRORROGA ? ahora + PRORROGA : a.fin;
  const s = [
    env.DB.prepare("UPDATE anuncios SET puja = ?1, pujador_id = ?2, fin = ?3, version = ?4 WHERE id = ?5")
      .bind(cantidad, u.id, fin, a.version + 1, a.id),
    env.DB.prepare("INSERT INTO pujas (anuncio_id, usuario_id, cantidad, fecha) VALUES (?1,?2,?3,?4)").bind(a.id, u.id, cantidad, ahora),
    saldo(env, u.id, -cantidad), mov(env, u.id, -cantidad, `Puja apartada: «${a.titulo}»`, a.id, null, ahora),
  ];
  if (a.pujador_id) s.push(saldo(env, a.pujador_id, a.puja),
    mov(env, a.pujador_id, a.puja, `Te superaron la puja: «${a.titulo}»`, a.id, null, ahora));
  // PENDIENTE (paso 4): avisar por DM a quien superaron.
  return (await lote(env, s)) || [200, { ok: true, puja: cantidad, fin }];
}

// Cierra las subastas terminadas. La llama el Cron Trigger cada minuto y también
// cada lista, para que nunca se vea abierta una que ya acabó.
export async function cerrarSubastas(env) {
  const ahora = Date.now();
  const r = await env.DB.prepare("SELECT * FROM anuncios WHERE tipo = 'subasta' AND estado = 'abierto' AND fin <= ?1").bind(ahora).all();
  for (const a of r.results) {
    const s = a.pujador_id ? [
      cerrar(env, a, "vendido", a.pujador_id, ahora),
      // las monedas del ganador ya estaban apartadas: solo cobra el vendedor
      saldo(env, a.autor_id, a.puja), mov(env, a.autor_id, a.puja, `Subasta vendida: «${a.titulo}»`, a.id, null, ahora),
      recibo(env, a, a.pujador_id, a.autor_id, a.puja, ahora),
    ] : [cerrar(env, a, "sin_venta", null, ahora)];
    await lote(env, s); // si otra petición la cerró a la vez, esta falla sin hacer nada
  }
}

// ---- Monedas ----
export async function movimientos(env, u, url) {
  const otro = url.searchParams.get("usuario");
  const quien = otro && u.rol === "admin" ? otro : u.id;
  const r = await env.DB.prepare(
    `SELECT m.id, m.cantidad, m.motivo, m.anuncio_id, m.fecha, a.nombre AS admin, r.anuncio_id AS recibo
     FROM movimientos m LEFT JOIN usuarios a ON a.id = m.admin_id
     LEFT JOIN recibos r ON r.anuncio_id = m.anuncio_id AND (r.comprador_id = m.usuario_id OR r.vendedor_id = m.usuario_id)
       AND m.motivo NOT LIKE 'Puja apartada%' AND m.motivo NOT LIKE 'Te superaron%'
     WHERE m.usuario_id = ?1 ORDER BY m.id DESC LIMIT 200`).bind(quien).all();
  const s = await env.DB.prepare("SELECT saldo FROM usuarios WHERE id = ?1").bind(quien).first();
  return [200, { saldo: s ? s.saldo : 0, movimientos: r.results }];
}

// Solo admins: dar (cantidad > 0) o quitar (cantidad < 0) monedas, siempre con motivo.
export async function darMonedas(env, u, d) {
  if (u.rol !== "admin") return [403, { error: "Solo los administradores pueden hacer esto" }];
  const quien = String(d.usuario_id || "");
  const cantidad = entero(d.cantidad, -MAX_MONEDAS, MAX_MONEDAS);
  const motivo = texto(d.motivo, 200);
  if (!cantidad) return [400, { error: "Cantidad no válida" }];
  if (!motivo) return [400, { error: "Falta el motivo" }];
  if (!await env.DB.prepare("SELECT 1 FROM usuarios WHERE id = ?1").bind(quien).first()) return [404, { error: "No existe ese usuario" }];
  const e = await lote(env, [saldo(env, quien, cantidad), mov(env, quien, cantidad, motivo, null, u.id, Date.now())]);
  if (e) return e[1].error === "No hay monedas suficientes" ? [400, { error: "No puede quedarse en negativo" }] : e;
  return [200, { ok: true }];
}

export async function usuarios(env, u) {
  if (u.rol !== "admin") return [403, { error: "Solo los administradores pueden hacer esto" }];
  const r = await env.DB.prepare("SELECT id, nombre, avatar, saldo FROM usuarios ORDER BY nombre COLLATE NOCASE").all();
  return [200, r.results];
}

// ---- Recibos ----
async function numeroRecibo(env, anuncio) {
  const r = await env.DB.prepare("SELECT numero FROM recibos WHERE anuncio_id = ?1").bind(anuncio).first();
  return r ? r.numero : null;
}

export async function datosRecibo(env, numero) {
  const r = await env.DB.prepare(
    `SELECT r.*, c.nombre AS comprador, v.nombre AS vendedor, a.objetos AS objetos_anuncio FROM recibos r
     LEFT JOIN usuarios c ON c.id = r.comprador_id LEFT JOIN usuarios v ON v.id = r.vendedor_id
     LEFT JOIN anuncios a ON a.id = r.anuncio_id WHERE r.numero = ?1`).bind(Number(numero)).first();
  if (!r) return null;
  // Las imágenes de los objetos no van dentro del recibo: se mandan adjuntas en el mismo mensaje.
  return { ...r, datos: { numero: r.anuncio_id, tipo: NOMBRE_TIPO[r.tipo], comprador: r.comprador || "?", vendedor: r.vendedor || "?",
    fecha: r.fecha, objetos: JSON.parse(r.objetos) } };
}

// ---- Enviar recibos con el bot ----
// Un mensaje con el recibo PNG y, si el anuncio tiene foto, la foto adjunta en el mismo mensaje.
// Va a: DM del comprador, DM del vendedor y el canal de registro de ventas (RECIBOS_CANAL).
async function mandarMensaje(env, canal, textoMsg, adjuntos) {
  const form = new FormData();
  form.append("payload_json", JSON.stringify({ content: textoMsg, allowed_mentions: { parse: [] },
    attachments: adjuntos.map((a, i) => ({ id: i, filename: a.nombre })) }));
  adjuntos.forEach((a, i) => form.append(`files[${i}]`, new Blob([a.datos], { type: a.tipo }), a.nombre));
  const r = await fetch(`https://discord.com/api/v10/channels/${canal}/messages`,
    { method: "POST", headers: { Authorization: "Bot " + env.DISCORD_BOT_TOKEN }, body: form });
  if (!r.ok) throw new Error("Discord " + r.status + ": " + (await r.text()).slice(0, 200));
}
// Correo con Brevo (secretos BREVO_API_KEY y CORREO_REMITENTE, este verificado en Brevo como remitente).
const b64 = buf => { let t = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 8192) t += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(t); };
async function mandarCorreo(env, para, asunto, texto, adjuntos) {
  if (!env.BREVO_API_KEY || !env.CORREO_REMITENTE) throw new Error("correo sin configurar");
  const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ sender: { name: "Mercadillo de Charcaland", email: env.CORREO_REMITENTE }, to: [{ email: para }],
      subject: asunto, textContent: texto.replace(/^🧾 /, "") + "\n\nSi no se entrega, avisad a un admin.",
      attachment: adjuntos.map(a => ({ name: a.nombre, content: b64(a.datos) })) }) });
  if (!r.ok) throw new Error("Brevo " + r.status + ": " + (await r.text()).slice(0, 200));
}
async function canalDM(env, usuario) {
  const r = await fetch("https://discord.com/api/v10/users/@me/channels", { method: "POST",
    headers: { Authorization: "Bot " + env.DISCORD_BOT_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: usuario }) });
  if (!r.ok) throw new Error("DM " + r.status);
  return (await r.json()).id;
}

export async function enviarRecibo(env, numero) {
  if (!env.DISCORD_BOT_TOKEN) return;
  // Se marca antes de enviar para que dos procesos no lo manden dos veces.
  const toma = await env.DB.prepare("UPDATE recibos SET enviado = 1 WHERE numero = ?1 AND enviado = 0").bind(numero).run();
  if (!toma.meta.changes) return;
  const r = await datosRecibo(env, numero);
  const nombre = `recibo-${String(r.anuncio_id).padStart(4, "0")}.png`;
  const fotos = [];
  // Una foto por objeto que la tenga, con el nombre del objeto como nombre de archivo.
  for (const [i, o] of JSON.parse(r.objetos_anuncio || "[]").entries()) {
    if (!o.imagen) continue;
    try {
      const f = await leerImagen(env, o.imagen.split("/").pop());
      if (!f) continue;
      const ext = f.tipo.split("/")[1] === "jpeg" ? "jpg" : f.tipo.split("/")[1];
      const base = o.nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "objeto";
      fotos.push({ nombre: `${i + 1}-${base}.${ext}`, tipo: f.tipo, datos: f.datos });
    } catch {}
  }
  const titulo = (await env.DB.prepare("SELECT titulo FROM anuncios WHERE id = ?1").bind(r.anuncio_id).first())?.titulo || "";
  const n = numeroAnuncio(r.anuncio_id);
  // Cada uno recibe su versión: el comprador «Compra» (o «Subasta»), el vendedor «Venta».
  const png = async lado => [{ nombre, tipo: "image/png", datos: await reciboPng(paraLado(r, lado)) }, ...fotos];
  const compra = await png("comprador"), venta = await png("vendedor");
  const envios = [
    [() => canalDM(env, r.comprador_id), `🧾 Has comprado «${titulo}» a ${r.vendedor} por ${r.total} monedas. Recibo ${n}.`, compra],
    [() => canalDM(env, r.vendedor_id), `🧾 Has vendido «${titulo}» a ${r.comprador} por ${r.total} monedas. Recibo ${n}.`, venta],
  ];
  // Canal de registro: la versión del comprador (PROVISIONAL)
  if (env.RECIBOS_CANAL) envios.push([async () => env.RECIBOS_CANAL,
    (r.comprador_id === "prueba" || r.vendedor_id === "prueba" ? "🧪 PRUEBA · " : "") + `🧾 ${NOMBRE_TIPO[r.tipo]} ${n}: ${r.vendedor} → ${r.comprador}, «${titulo}», ${r.total} monedas.`, compra]);
  let bien = 0;
  for (const [canal, msg, adjuntos] of envios) {
    try { await mandarMensaje(env, await canal(), msg, adjuntos); bien++; }
    catch (e) { console.error("Recibo " + numero, e.message); } // p. ej. alguien con los DM cerrados
  }
  // Quien tiene correo apuntado (la cuenta sin Discord) lo recibe también por correo, con los mismos adjuntos.
  const correos = await env.DB.prepare("SELECT id, correo FROM usuarios WHERE id IN (?1, ?2) AND correo IS NOT NULL")
    .bind(r.comprador_id, r.vendedor_id).all();
  for (const c of correos.results) {
    const comprador = c.id === r.comprador_id;
    try {
      await mandarCorreo(env, c.correo, `Recibo ${n} · ${comprador ? "Compra" : "Venta"}: ${titulo}`,
        comprador ? envios[0][1] : envios[1][1], comprador ? compra : venta);
      bien++;
    } catch (e) { console.error("Correo recibo " + numero, e.message); }
  }
  // Si no salió ninguno (Discord caído), se deja para que el Cron lo reintente.
  if (!bien) await env.DB.prepare("UPDATE recibos SET enviado = 0 WHERE numero = ?1").bind(numero).run();
}

export async function enviarPendientes(env) {
  const r = await env.DB.prepare("SELECT numero FROM recibos WHERE enviado = 0 ORDER BY numero LIMIT 10").all();
  for (const x of r.results) await enviarRecibo(env, x.numero);
}

// Imagen del recibo: solo la ven comprador, vendedor y admins.
// Imagen del recibo por número de anuncio (/api/recibo/0001.png): solo comprador, vendedor y admins.
export async function imagenRecibo(env, u, anuncio) {
  const x = await env.DB.prepare("SELECT numero FROM recibos WHERE anuncio_id = ?1").bind(Number(anuncio)).first();
  const r = x && await datosRecibo(env, x.numero);
  if (!r) return null;
  if (u.rol !== "admin" && u.id !== r.comprador_id && u.id !== r.vendedor_id) return false;
  return reciboPng(paraLado(r, u.id === r.vendedor_id ? "vendedor" : "comprador"));
}

// «TIPO DE VENTA» según quién lo recibe: Compra / Subasta para el comprador, Venta para el vendedor.
export const paraLado = (r, lado) =>
  ({ ...r.datos, tipo: lado === "vendedor" ? "Venta" : r.tipo === "subasta" ? "Subasta" : "Compra" });

// Imágenes subidas con los anuncios (se sirven en /api/imagen/ID)
export async function leerImagen(env, id) {
  const r = await env.DB.prepare("SELECT tipo, datos FROM imagenes WHERE id = ?1").bind(Number(id)).first();
  return r ? { tipo: r.tipo, datos: new Uint8Array(r.datos) } : null;
}
