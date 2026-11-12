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

let listo = null;
const preparar = () => listo || (listo = Promise.all([initSatori(yogaWasm), initWasm(resvgWasm)]));

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const fila = (k, v, fuerte) => `
  <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #3a3f2e">
    <span style="color:#a9b08f">${k}</span>
    <span style="color:${fuerte ? "#ffd66b" : "#f2f0e6"};font-weight:${fuerte ? 800 : 400}">${v}</span>
  </div>`;

// r: { numero, tipo, objeto, cantidad, comprador, vendedor, precio, fecha (Date o ms) }
export function plantilla(r) {
  const f = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit",
    year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(r.fecha));
  return `
  <div style="display:flex;flex-direction:column;box-sizing:border-box;width:600px;height:470px;background:#1f2318;font-family:Nunito;font-size:22px;padding:36px;border:6px solid #5b8c3a">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:34px;font-weight:800;color:#7fc24a">Charcaland</span>
      <span style="color:#a9b08f">Recibo nº ${esc(r.numero)}</span>
    </div>
    <span style="color:#a9b08f;margin:4px 0 22px">Mercadillo · ${esc(r.tipo)}</span>
    <div style="display:flex;flex-direction:column">
      ${fila("Objeto", esc(r.objeto) + (r.cantidad > 1 ? ` ×${esc(r.cantidad)}` : ""))}
      ${fila("Comprador", esc(r.comprador))}
      ${fila("Vendedor", esc(r.vendedor))}
      ${fila("Fecha", esc(f))}
      ${fila("Precio", esc(r.precio) + " monedas", true)}
    </div>
    <span style="margin-top:24px;color:#e8a25c;font-size:18px">Si no se entrega, avisad a un admin.</span>
  </div>`;
}

export async function reciboPng(r) {
  await preparar();
  const svg = await satori(html(plantilla(r)), {
    width: 600, height: 470,
    fonts: [{ name: "Nunito", data: nunito400, weight: 400 }, { name: "Nunito", data: nunito800, weight: 800 }],
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
}
