# Plan del mercadillo (decidido con el usuario, 12/11/2026)

Estado: **solo diseño hablado y librerías descargadas.** No hay nada programado todavía.

## Monedas
- Las dan y las quitan los admins desde la web, siempre con un motivo, y queda en el registro. Con eso también se arreglan las compras que no se entregan: se devuelve a uno y se quita al otro; la entrega se revisa en el juego.
- Nunca se puede quedar nadie con saldo negativo.

## Anuncios (los tres tipos)
- **Vendo:** precio fijo. «Comprar» → confirmar → el pago se hace **al momento** (el comprador paga y el vendedor cobra) y el anuncio desaparece. La entrega se hace en el juego.
- **Busco** *(provisional)*: digo qué quiero y cuánto pago; otro pulsa «Lo tengo» y yo pulso «Aceptar» para pagar al momento.
- **Subasta** *(provisional)*: precio de salida, puja mínima y hora de fin. Al pujar se apartan las monedas; si te superan, se devuelven y se avisa por DM. Al terminar, el pago se hace solo; sin pujas, termina sin venta.
- **Prórroga anti último segundo:** si alguien puja cuando quedan 30 s o menos, el fin se mueve a 30 s después de esa puja. Se repite con cada puja, así que la subasta solo acaba cuando pasan 30 s sin pujas nuevas.
- Cada anuncio lleva nombre, cantidad, categoría y precio, más imagen y descripción opcionales (texto libre, que sirve también para objetos de mods).
- Categorías *(provisionales)*: bloques, herramientas y armas, armadura, comida, de mods, encantamientos y libros, otros.

## Página
- Pestañas **como en el resto de la web** (las de Eventos y la wiki): Todo · Vendo · Busco · Subastas. La categoría y el orden van en desplegables a la derecha. Botón «+ Nuevo anuncio».
- Rejilla de tarjetas: etiqueta del tipo, imagen o icono, nombre ×cantidad, vendedor con foto, categoría, precio y botón (Comprar / Lo tengo / Pujar con la mínima). Las subastas muestran pujas y tiempo restante.
- Ventana de compra **sencilla**: objeto, precio y «Comprar» / «Cancelar». Sin «tu saldo queda…» ni texto explicativo.
- Tu tienda (ver, crear, editar y quitar tus anuncios) irá en el perfil **más adelante**.

## Recibos
- Cada compra, venta, subasta ganada y movimiento de monedas queda en la base de datos.
- Por cada compra se genera un **recibo como imagen (PNG)** a partir de una plantilla HTML+CSS que **rellena la API sola**. El usuario no la edita; el diseño del recibo lo revisaremos aparte.
- Contenido (diseño Ghestec): logo y «RECIBO #0001»; tipo de venta, fecha, comprador y vendedor; lista de objetos (cantidad, nombre, precio, importe) con sus encantamientos debajo de cada uno; subtotal, IVA 0 % y total; «Si no se entrega, avisad a un admin». La imagen del objeto no va en el recibo: el bot la manda como adjunto aparte.
- El **bot de Charcaland** (aplicación `1569682266156957696`, secreto `DISCORD_BOT_TOKEN`) manda la imagen por **DM a comprador y vendedor** y la publica en un **canal privado** de recibos. Falta: que el usuario cree el canal, dé al bot permiso para escribir en él y pase el ID del canal.
- Imagen hecha en la API con **Satori** (HTML+CSS a SVG; solo entiende CSS con flex, no grid) y **Resvg** (SVG a PNG). Fuente: **Nunito** (400 y 800).

## Ya descargado (en `api/`)
- npm: `satori`, `satori-html`, `@resvg/resvg-wasm` (en `api/package.json`).
- Fuentes: `api/src/fuentes/nunito-400.ttf` y `nunito-800.ttf` (fontsource, Nunito 5.1.0).

## Orden para seguir
1. Plantilla del recibo y una foto de prueba para enseñársela al usuario.
2. Base de datos y API del mercadillo (anuncios, pujas, movimientos de monedas, recibos).
3. Página del mercadillo con los cambios de arriba.
4. Conectar los recibos (DM y canal privado).
