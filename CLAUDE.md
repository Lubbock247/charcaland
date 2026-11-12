# Webpage (web de Charcaland)

Web del servidor de Minecraft Charcaland: inicio, eventos, lore, mods, mercadillo entre jugadores, sugerencias, updates y perfil. Tiene wikis de Mods y de Lore con editor, enlaces, cajas y tablas, y permisos. Entrar se hace con Discord.

Es privada, para el usuario y sus amigos. Repositorio git propio (rama `main`).

## Estructura

- **Páginas HTML en la raíz:** `index.html`, `eventos.html`, `lore.html`, `mercadillo.html`, `mods.html`, `perfil.html`, `sugerencias.html`, `updates.html`.
- **`css/estilo.css`:** todos los estilos.
- **`js/datos.js`:** el contenido que se edita sin tocar el resto (nombre del servidor, enlaces, eventos). Lo marcado como PROVISIONAL es de ejemplo.
- **`js/app.js`:** lógica común: cabecera, pie, sesión.
- **`js/wiki.js`:** editor y vista previa de las wikis.
- **`api/`:** servidor de cuentas, saldo y wikis. Es un Cloudflare Worker (`charcaland-api`) con base de datos D1 (`charcaland`).
  - `api/src/index.js`: rutas (por ejemplo `/api/yo` y `/api/wiki`) y comprobación de Discord.
  - `api/schema.sql`: tablas `usuarios` y `paginas`.
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

- **Webhook de Discord en `js/datos.js`:** la URL del webhook, con su token, está a la vista en el JavaScript de la web (`CONFIG.webhookDiscord`). Cualquiera que abra la página puede usarla. Conviene pasar el envío a la API del Worker y guardar el webhook como secreto. **Pendiente de decidir con el usuario.**
- **Publicación:** no está documentado aquí cómo se publica el front (ORIGENES sugiere GitHub Pages). Confirmar con el usuario antes de dar pasos de publicación.
