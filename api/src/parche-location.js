// Satori trae HarfBuzz (motor de texto), que al cargar lee self.location.href y compila
// su WASM desde bytes. Los Workers no tienen location ni dejan compilar WASM al vuelo,
// así que se le da el mismo módulo ya compilado que empaqueta wrangler.
import hbModulo from "harfbuzzjs/hb.wasm";

if (!globalThis.location) globalThis.location = { href: "https://worker.local/" };

const W = WebAssembly, instReal = W.instantiate.bind(W);
W.instantiate = async (b, imp) => {
  if (b instanceof W.Module) return instReal(b, imp);
  return { instance: await instReal(hbModulo, imp), module: hbModulo }; // bytes: solo los usa HarfBuzz
};
