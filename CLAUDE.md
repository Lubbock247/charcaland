# Webpage (web de Charcaland)

Web del servidor de Minecraft Charcaland: inicio, eventos, lore, mods, mercadillo entre jugadores, sugerencias, updates y perfil. Tiene wikis de Mods y de Lore con editor, enlaces, cajas y tablas, y permisos. Entrar se hace con Discord.

Es privada, para el usuario y sus amigos. Repositorio git propio (rama `main`).

## Estructura

- **Páginas HTML en la raíz:** `index.html`, `eventos.html`, `lore.html`, `mercadillo.html`, `mods.html`, `perfil.html`, `sugerencias.html`, `updates.html`.
- **`css/estilo.css`:** todos los estilos.
- **`js/datos.js`:** ajustes que se editan sin tocar el resto (nombre del servidor, enlaces, eventos aún). Las updates ya están en la base de datos. Lo marcado como PROVISIONAL es de ejemplo.
- **`js/app.js`:** lógica común: cabecera, pie, sesión.
- **`js/wiki.js`:** editor y vista previa de las wikis.
- **`api/`:** servidor de cuentas, saldo y wikis. Es un Cloudflare Worker (`charcaland-api`) con base de datos D1 (`charcaland`).
  - `api/src/index.js`: rutas (por ejemplo `/api/yo` y `/api/wiki`) y comprobación de Discord.
  - `api/schema.sql`: tablas `usuarios`, `paginas` y `noticias` (eventos y updates; las crean los admins desde la web).
  - `api/semilla*.sql`: datos de ejemplo para la base de datos.
  - `api/wrangler.jsonc`: nombre del Worker, base de datos, identificadores de Discord, administradores y orígenes permitidos (`ORIGENES`, para CORS).
- **`api/` dependencias:** `wrangler` (en `api/package.json`). Se ejecuta desde esa carpeta.

## Reglas

- **Caché de estilos y scripts:** cada `css/...` y `js/...` lleva `?v=N` en las páginas. Al cambiar un archivo, sube ese número (el último cambio lo hizo así para evitar la caché).
- **Cambios en la API:** el front y la API se hablan por la dirección de `js/datos.js` (`CONFIG.api`). Si cambia una ruta, cambia las dos partes.
- **Administradores:** la lista de identificadores de Discord está en `api/wrangler.jsonc`. No la copies a otros sitios.
- **Probar en local:** `127.0.0.1:8765` está permitido por CORS. Sirve la carpeta ahí para probar el front.
- **Commits:** no hagas commit ni push sin que el usuario lo pida.

## Por revisar

- **Sugerencias:** se envían por `POST /api/sugerencia` (hace falta sesión de Discord; 30 s entre envíos por usuario). El webhook es el secreto `WEBHOOK_SUGERENCIAS` del Worker (`npx wrangler secret put WEBHOOK_SUGERENCIAS`); nunca va en el front. El webhook antiguo quedó en el historial de git: hay que borrarlo en Discord.
- **Publicación:** el front está publicado en GitHub Pages con enlace público; al usuario le vale así. Lo que se sube a `main` acaba en la web, así que no hagas push sin que lo pida.
- **Votaciones:** un evento con 2 o más opciones es una votación (tablas `opciones` y `votos`, ruta `POST /api/votar`, que pone o quita el voto). Opciones: `multiple` (varias respuestas) y `anonima` (solo los admins ven quién votó). Se vota desde la lista o dentro del evento; en eventos pasados ya no se puede. No hay «cerrar votación»: el usuario no la quiere. Los eventos sin fecha con `en_inicio` salen en la pestaña Inicio. Las updates usan `etiqueta` como versión (`1.0.0`); los eventos no tienen etiqueta ni píldoras de estado.
- **Eventos en Discord:** los eventos con fecha futura se crean, cambian y borran solos en «Eventos» del servidor de Discord (`sincronizarDiscord` en la API; columna `discord_id`). Necesita el secreto `DISCORD_BOT_TOKEN` del bot de la aplicación, invitado al servidor con permiso de crear y gestionar eventos. Horas en hora de España; sin hora, 18:00 a 20:00.
- **Por probar:** `por-probar.md` recoge lo que necesita cuentas reales de Discord.
- **Mercadillo:** programado y en la web; diseño en `plan-mercadillo.md`, estado y pendientes en `traspaso.md`. Tablas en `api/mercadillo*.sql`.
- **Recibos:** PNG (`api/src/recibo.js`) por DM, canal de registro (`RECIBOS_CANAL`) y, a quien tiene correo, por Gmail con un script de Google (`api/correo-gmail.gs`, secretos `CORREO_URL` y `CORREO_CLAVE`).
- **Bot `/clear`:** en el DM del bot, solo admins (`api/src/comandos.js`); lo lee el Cron cada minuto.
- **Cuenta sin Discord:** una sola, temporal, para el admin Rolfin (`api/src/cuentas.js`, `entrar.html`). Los admins salen de `ADMIN_IDS` más los cambios de id de `bot_estado` (`listaAdmins`): usa esa función, no la lista a pelo.
