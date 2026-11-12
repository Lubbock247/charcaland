# Traspaso: mercadillo de Charcaland (recibo en imagen)

Para seguir en un chat nuevo. Lee antes `CLAUDE.md` y `plan-mercadillo.md` (todo el diseño decidido).

**Al terminar de leerlo:** borra este archivo y `recibo-referencia.png` (con commit). `recibo-referencia.png` es la foto del recibo aprobado: úsala como referencia de cómo debe quedar y bórrala cuando ya no haga falta.

## Hecho
- **Recibo como imagen PNG**, generado en la API: `api/src/recibo.js`.
  - Plantilla HTML+CSS → Satori (SVG) → Resvg (PNG). Satori solo entiende flex.
  - Fuente Nunito 400/800 (`api/src/fuentes/`), logo `api/src/recursos/ghestec.png`.
  - `wrangler.jsonc` tiene la regla `Data` para `.ttf` y `.png`.
  - `api/src/parche-location.js`: arreglo necesario para que Satori (HarfBuzz) funcione en Workers. No quitar.
- **Diseño aprobado por el usuario** (estilo Ghestec, fondo `#16141f`, celeste `#a6dcef`):
  logo + «GHESTEC» y «RECIBO #0001»; tipo de venta, fecha, comprador, vendedor;
  tabla CANT. · ARTÍCULO · PRECIO · IMPORTE con encantamientos debajo de cada objeto;
  subtotal, IVA 0 % (se calcula igual) y TOTAL; pie con «Si no se entrega, avisad a un admin».
  Sin iconos por objeto. La imagen del objeto NO va en el recibo: el bot la manda como adjunto aparte.
- Datos que recibe `reciboPng(r)`:
  `{ numero, tipo, comprador, vendedor, fecha, objetos: [{ nombre, cantidad, precio, encantamientos? }] }`.
- **Ruta de prueba** `/api/recibo-prueba` en `api/src/index.js`: solo responde en 127.0.0.1 (`npx wrangler dev --ip 127.0.0.1 --port 8787` desde `api/`).
- Plan actualizado: prórroga de subastas (puja en los últimos 30 s → fin a 30 s de esa puja, repetible) y contenido del recibo.

## Estado de git
- Commit `aea8416` (primera versión del recibo) está subido.
- Diseño Ghestec, encantamientos, plan, este traspaso y la foto de referencia: guardados y subidos.
- La API no se ha desplegado en Cloudflare con el recibo (pesa ~1,8 MB comprimida, límite 3 MB).

## Siguiente
2. Base de datos y API del mercadillo (anuncios Vendo/Busco/Subasta, compra con varios objetos, pujas que apartan monedas, prórroga de 30 s, cierre por Cron Trigger, monedas de admins con motivo, movimientos y recibos). Incluir encantamientos por objeto.
3. Página `mercadillo.html` (vista previa antes de cambios visuales).
4. Bot: recibo por DM a comprador y vendedor + canal privado (pedir ID del canal), con la imagen del objeto como adjunto.

Avanzar por partes y parar tras cada una para que el usuario pruebe.
