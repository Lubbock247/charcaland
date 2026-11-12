// Recibo del mercadillo como imagen PNG: plantilla HTML+CSS -> Satori (SVG) -> Resvg (PNG).
// Satori solo entiende flex (no grid). La API rellena la plantilla sola.
import "./parche-location.js";
import satori, { init as initSatori } from "satori/standalone";
import { html } from "satori-html";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import yogaWasm from "satori/layout.wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import nunito400 from "./fuentes/nunito-400.ttf";
import nunito800 from "./fuentes/nunito-800.ttf";
import logoPng from "./recursos/ghestec.png";

const b64 = buf => { let t = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 8192) t += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(t); };
const LOGO = "data:image/png;base64," + b64(logoPng);
// Colores de Ghestec
const C = { fondo: "#16141f", caja: "#1e1c2a", linea: "#2c2a3c", celeste: "#a6dcef", texto: "#eef3f8", suave: "#8f93a8" };

let listo = null;
const preparar = () => listo || (listo = Promise.all([initSatori(yogaWasm), initWasm(resvgWasm)]));

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const mon = n => Number(n).toLocaleString("es-ES") + " monedas";
const W = 640;
// Alto de la imagen según objetos y líneas de encantamiento.
const alto = objs => 460 + objs.reduce((t, o) => t + 52 + (o.encantamientos?.length || 0) * 26, 0);

const dato = (k, v) => `
  <div style="display:flex;flex-direction:column;width:50%;margin-bottom:12px">
    <span style="color:${C.suave};font-size:14px;letter-spacing:1px">${k}</span>
    <span style="color:${C.texto};font-size:19px">${v}</span>
  </div>`;

const total = (k, v, fuerte) => `
  <div style="display:flex;justify-content:space-between;width:280px;padding:5px 0;${fuerte ? `border-top:2px solid ${C.celeste};margin-top:6px;padding-top:10px;` : ""}">
    <span style="color:${fuerte ? C.texto : C.suave};font-weight:${fuerte ? 800 : 400}">${k}</span>
    <span style="color:${fuerte ? C.celeste : C.texto};font-weight:${fuerte ? 800 : 400}">${v}</span>
  </div>`;

// r: { numero, tipo, comprador, vendedor, fecha (Date o ms), objetos: [{ nombre, cantidad, precio (por unidad), encantamientos?: ["Eficiencia V", ...] }] }
export function plantilla(r) {
  const f = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit",
    year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(r.fecha));
  const subtotal = r.objetos.reduce((s, o) => s + o.cantidad * o.precio, 0);
  const iva = Math.round(subtotal * 0); // IVA del 0 %
  const filas = r.objetos.map(o => `
    <div style="display:flex;flex-direction:column;padding:12px 0;border-bottom:1px solid ${C.linea};font-size:18px">
      <div style="display:flex;align-items:center">
        <span style="width:56px;color:${C.celeste};font-weight:800">${esc(o.cantidad)}×</span>
        <span style="flex:1;color:${C.texto}">${esc(o.nombre)}</span>
        <span style="width:110px;text-align:right;color:${C.suave}">${esc(o.precio)}</span>
        <span style="width:110px;text-align:right;color:${C.texto}">${esc(o.cantidad * o.precio)}</span>
      </div>
      ${(o.encantamientos || []).map(e => `
      <div style="display:flex;margin:4px 0 0 56px;color:${C.suave};font-size:15px">
        <span style="color:${C.celeste};margin-right:8px">–</span><span>${esc(e)}</span>
      </div>`).join("")}
    </div>`).join("");
  const cab = t => `<span style="font-size:13px;letter-spacing:1px;color:${C.suave}">${t}</span>`;
  return `
  <div style="display:flex;flex-direction:column;box-sizing:border-box;width:${W}px;height:${alto(r.objetos)}px;background:${C.fondo};font-family:Nunito;font-size:20px;padding:30px 36px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center">
        <img src="${LOGO}" width="56" height="56" style="border-radius:10px" />
        <span style="margin-left:12px;font-size:32px;font-weight:800;letter-spacing:3px;color:${C.texto}">GHESTEC</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end">
        <span style="color:${C.suave};font-size:14px;letter-spacing:2px">RECIBO</span>
        <span style="color:${C.celeste};font-weight:800;font-size:28px">#${String(r.numero).padStart(4, "0")}</span>
      </div>
    </div>
    <div style="display:flex;height:3px;background:${C.celeste};margin:18px 0 18px;border-radius:2px"></div>
    <div style="display:flex;flex-wrap:wrap">
      ${dato("TIPO DE VENTA", esc(r.tipo))}
      ${dato("FECHA", esc(f))}
      ${dato("COMPRADOR", esc(r.comprador))}
      ${dato("VENDEDOR", esc(r.vendedor))}
    </div>
    <div style="display:flex;padding:8px 0;margin-top:6px;border-bottom:1px solid ${C.suave}">
      <div style="display:flex;width:56px">${cab("CANT.")}</div>
      <div style="display:flex;flex:1">${cab("ARTÍCULO")}</div>
      <div style="display:flex;width:110px;justify-content:flex-end">${cab("PRECIO")}</div>
      <div style="display:flex;width:110px;justify-content:flex-end">${cab("IMPORTE")}</div>
    </div>
    ${filas}
    <div style="display:flex;flex-direction:column;align-items:flex-end;margin-top:14px;font-size:18px">
      ${total("Subtotal", mon(subtotal))}
      ${total("IVA (0 %)", mon(iva))}
      ${total("TOTAL", mon(subtotal + iva), true)}
    </div>
    <div style="display:flex;margin-top:auto;justify-content:space-between;color:${C.suave};font-size:14px">
      <span>Mercadillo de Charcaland · Ghestec</span>
      <span>Si no se entrega, avisad a un admin.</span>
    </div>
  </div>`;
}

export async function reciboPng(r) {
  await preparar();
  const svg = await satori(html(plantilla(r)), {
    width: W, height: alto(r.objetos),
    fonts: [{ name: "Nunito", data: nunito400, weight: 400 }, { name: "Nunito", data: nunito800, weight: 800 }],
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: W * 2 } }).render().asPng();
}
