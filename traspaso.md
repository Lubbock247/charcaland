# Traspaso: misiones, mercadillo, bot y cuenta sin Discord (16/11/2026)

Para seguir en un chat nuevo. Lee antes `CLAUDE.md` y `plan-mercadillo.md`.

## Estado
- **Todo subido y publicado (16/11/2026), último commit de código `ae41eec`:** no queda nada pendiente de subir.
  - `0f7849f`: Misiones (página, encargos con dos precios, bloque del perfil), Administración por pestañas y la retirada de «Probar correo». Tablas de `misiones.sql` aplicadas en la base de datos real y API desplegada en Cloudflare.
  - `ae41eec`: solo parte visual (filas con talón, formularios sin textos de ayuda, Inicio solo con lo tuyo, encargos propios solo en el perfil). La API y la base de datos no cambiaron.
- Comprobado tras subir: la web publicada sirve `misiones.js?v=3` y `estilo.css?v=39`, la página de Misiones carga sin sesión y `/api/misiones` responde. Nada probado aún con cuentas reales (lista en `por-probar.md`).
- **Cómo se publica** (solo cuando el usuario lo pida): si cambian tablas, `npx wrangler d1 execute charcaland --remote --file=ARCHIVO.sql` desde `api/`; si cambia la API, `npx wrangler deploy` desde `api/`; y commit con push a `main` para la web. Si solo cambia la parte visual, basta el push.
- Anterior: commit `5f6e3a6` (mercadillo, recibos, perfil, inicio nuevo, Administración solo con monedas, sin modo pruebas).
- Si en el navegador se ve lo viejo, es la caché: Ctrl+F5.
- Sin subir al repositorio: `.claude/`, `ejemplos-recibo/`, `previas-misiones/` (imágenes de los diseños; se puede borrar) y `pruebas-local/` (herramientas de prueba; el usuario no ha dicho si las quiere en el repositorio).

## Misiones (`misiones.html`, `js/misiones.js`, `api/src/misiones.js`, `api/misiones.sql`)
Página nueva en el menú, entre Mercadillo y Sugerencias. Diseño elegido por el usuario: **B, filas**. Pestañas: Inicio · Misiones personales · Misiones globales · Encargos.
Recompensa: monedas (las paga la web), objetos (texto libre, uno por línea; se entregan en el juego) o las dos cosas.

Decidido por el usuario:
- **Confirmar:** quien la tiene pulsa «Completado» y pasa a «Pendiente de revisar». Las personales y globales las aprueba un admin; un encargo, quien lo creó o un admin. Al aprobar se paga. «No está hecha» la devuelve a «En curso». Un admin puede darla por completada sin que el jugador pulse nada.
- **Personales:** las pone y las quita un admin a cada persona, máximo 6. El jugador puede rechazar una y desaparece. No caducan.
- **Globales:** las crean los admins; cada una la tiene una sola persona. Máximo 3 aceptadas al día y 3 a la vez. Abandonarla la deja libre, pero sigue contando para las 3 del día (tabla `misiones_aceptadas`).
- **Encargos:** los crea cualquiera con «+ Nuevo encargo», máximo 10 al día; los acepta una sola persona, que puede tener como mucho 3 aceptados a la vez. Los de «Administración» (creados desde el panel) no descuentan a nadie.
- **Dos precios del encargo:** «completado» (mínimo, `monedas_min`) y «satisfactorio» (máximo, `monedas`). Al publicarlo se aparta el máximo. Al aprobarlo, quien lo creó elige cuál paga en una ventana (`ventanaPago`): con el mínimo se le devuelve la diferencia; puede añadir dinero extra, que sale de su saldo en ese momento. Si se borra, se devuelve todo. Con un solo precio, los dos son iguales.
- **Perfil:** debajo de la tienda, bloque «Mis encargos» (`perfilEncargos` en `js/misiones.js`) con los encargos que has creado; arriba, «Por verificar».
- **Día:** empieza a las 00:00, hora de España (`inicioDia`).
- **Recibo del encargo:** PNG en morado (`datosReciboEncargo`, `enviarReciboEncargo`; el Cron reintenta si no sale ninguno). Se manda al aprobar el encargo, que es cuando se sabe el precio: por privado a quien lo creó y a quien lo hizo, al canal `RECIBOS_CANAL` y por correo a quien tenga correo. Pone «Encargo · Completado» o «Satisfactorio» y el dinero extra en su línea.

Cambios pedidos por el usuario el 16/11 tras verlo en la web (subidos después, solo parte visual: `js/misiones.js`, `js/app.js`, `css/estilo.css` y números de versión):
- Inicio de Misiones solo enseña lo tuyo (tus personales y lo que tienes en curso); sin nada de eso, sale vacío. Sin contadores de límites.
- Fuera los textos descriptivos de cada pestaña y de los formularios (regla general en `CLAUDE.md`: solo «(opcional)» u «(obligatorio)»).
- Formulario: título, precio, descripción y objetos; cada objeto en su fila (cantidad × nombre) con «Añadir objeto».
- «Mis encargos» del perfil va debajo de la tienda; «Ir a Encargos» es un botón pequeño.
- Filas con el diseño 3 elegido por el usuario (`filaMision`): talón a la izquierda con la recompensa en grande y los objetos, texto en el centro y botones apilados a la derecha.
- Los encargos que has creado tú no salen en la página de Misiones (ni en Inicio ni en Encargos): solo en tu perfil, donde también se verifican. Al crear uno, la web te lleva al perfil.

Propuesto por Claude y **confirmado por el usuario el 16/11** (salvo lo indicado):
- Quien crea un encargo solo lo puede borrar mientras nadie lo haya aceptado; después, solo un admin.
- «Pendiente de revisar» **no** cuenta dentro de las 3 globales a la vez (decidido por el usuario el 16/11; cambiado en `api/src/misiones.js`, sin desplegar).
- Nadie acepta su propio encargo.
- «los encargos que hiciste» del perfil son los que has creado (no los que has realizado para otros), y el recibo se manda cuando se aprueba el completado, no cuando el jugador pulsa «Completado».
- El dinero extra solo lo da quien creó el encargo; un admin que aprueba el de otro elige precio pero no da extra.
- Las globales y encargos que ya tiene otra persona se siguen viendo, apagados, con «La tiene X».

### Administración (`admin.html`, `admin()` en `js/app.js`, `adminMisiones` en `js/misiones.js`)
Pestañas **Monedas** (lo de antes) y **Misiones**: a la izquierda «Por revisar», «Misiones globales», «Encargos» y cada jugador con su contador (2/6); a la derecha lo elegido, con crear, aprobar y pagar, «No está hecha», liberar y borrar.

### Qué está probado (solo en local, con datos inventados y base de datos local; en la web real falta que lo pruebe el usuario)
- **Reglas de la API:** 81 comprobaciones con `pruebas-local/prueba-api.js` (permisos, máximo 6, 3 a la vez, 3 al día, 10 encargos al día, monedas apartadas y devueltas, no pagar dos veces, los dos precios, el dinero extra y los 3 encargos a la vez). Todas bien.
- **Página, perfil y panel en el navegador:** ventana de pago del encargo (mínimo + extra) desde el perfil, crear encargo con dos precios, aceptar, completar, aprobar y pagar, poner misión a un jugador, cambio de pestañas, saldo de la cabecera, ancho de móvil sin desbordes. Sin errores en la consola.
- **Recibo morado:** solo la imagen (`/api/recibo-prueba?tipo=Encargo` en local).
- **Sin probar:** el envío del recibo al canal de Discord, todo con cuentas reales de Discord y nada en la web real.

## Probar en local
- Configuraciones en `MinecraftMods/.claude/launch.json` (la que usa la vista previa; la de `Webpage/.claude/` no se usa): `api-local` (wrangler dev en 8787, base de datos local) y `web-local` (`pruebas-local/servir.py` en 8765: sirve la web, reenvía `/api` a la API local y con `?como=NOMBRE` hace de ese usuario; los que empiezan por `admin` son admins; `?como=` sale de la sesión).
- Tablas locales: `npx wrangler d1 execute charcaland --local --file=misiones.sql` (ya aplicado).
- `pruebas-local/datos-inventados.js` pone misiones de ejemplo (usuarios `admin`, `Lubbock`, `Rolfin`, `Esdeath`, `Tatsumi`).
- Las sesiones de prueba usan `api/.dev.vars` (`PRUEBAS_LOCAL=1`, cabecera `X-Prueba-Usuario`); nunca se sube.
- `wrangler dev` puede dejar procesos vivos: al terminar, comprobar que no queda nada escuchando en 8787.

## Mercadillo, recibos, bot y cuenta de Rolfin (sin cambios desde el 13/11, salvo «Probar correo»)
- Mercadillo (`mercadillo.html`, `js/mercadillo.js`, `api/src/mercadillo.js`): Vendo, Busco y Subasta; detalle, pujas, editar y quitar. En la base de datos puede quedar el usuario `prueba` del antiguo modo pruebas.
- «Probar correo» y la ruta `/api/correo-prueba` están quitados (16/11, sin subir). Los recibos por correo a quien tiene `usuarios.correo` (solo Rolfin) siguen igual.
- Recibos: PNG (`api/src/recibo.js`) por DM a comprador y vendedor, al canal `RECIBOS_CANAL` y por correo (`api/correo-gmail.gs`, secretos `CORREO_URL` y `CORREO_CLAVE`).
- Bot en el privado (`api/src/comandos.js`): `/clear` respondiendo a un mensaje (probado por el usuario) y `/clear-chat` (sin probar). Solo admins; lo lee el Cron cada minuto.
- Cuenta sin Discord de Rolfin (`api/src/cuentas.js`, `entrar.html`): entra con su enlace, correo y contraseña. «Conectar con Discord» en el perfil pasa todo a su cuenta de Discord (`listaAdmins`).
- Perfil (`perfil.html`): cartel y tienda con tus anuncios.

## Pendiente de revisar
1. **Misiones:** que el usuario las pruebe en la web real (sobre todo el recibo del encargo por privado y en el canal). Falta desplegar la API con el cambio del límite de globales.
2. **Correo a Rolfin:** le llega (confirmado 16/11).
3. **Reintento del correo:** si el correo falla pero Discord no, no se reintenta. No corre prisa.
4. **Conectar con Discord:** solo probado en local; Rolfin lo hará cuando tenga cuenta.
5. **Sin probar en la web real:** perfil (editar y quitar desde la tienda, menú del avatar), `/clear-chat`, inicio nuevo y Administración.
6. **Mercadillo con amigos reales:** el usuario lo probará con Rolfin.

## Menú móvil y app instalable (16/11/2026, sin subir)
- Orden del menú (web y móvil): Inicio · Misiones · Eventos · Mods · Lore · Mercadillo · Updates · Sugerencias (`PAGINAS` en `js/app.js`).
- Por debajo de 800 px de ancho: 3 rayas a la izquierda y menú lateral (diseño A elegido, sin X; se cierra pulsando fuera o en las rayas). Abajo: avatar + «Mi perfil» + monedas, «Administración» (solo admins) y «Salir». Estilos al final de `css/estilo.css`.
- App instalable: `manifest.webmanifest`, `sw.js` (no guarda nada en caché, solo permite instalar) e icono provisional «CL» en `img/icono-*.png`. Enlazados en el `<head>` de todas las páginas.
- Probado en local a 375 px: menú abre y cierra, pie con y sin admin, sin desbordes. Sin probar: instalarla en un móvil real (necesita HTTPS, o sea la web publicada).
- Vista previa del diseño en `previas-movil/` (no se sube).
