# Traspaso: mercadillo, bot y cuenta sin Discord (13/11/2026)

Para seguir en un chat nuevo. Lee antes `CLAUDE.md` y `plan-mercadillo.md`.
Al terminar de leerlo, este archivo se puede borrar (pregunta al usuario antes de hacer commit).

## Estado: todo subido y funcionando en la web
Último commit: `df0ffce`. API desplegada en Cloudflare. Base de datos real con todas las tablas
(`mercadillo.sql`, `mercadillo2.sql`, `mercadillo3.sql`, `cuentas.sql` ya aplicados en remoto).

### Mercadillo (`mercadillo.html`, `js/mercadillo.js`, `api/src/mercadillo.js`)
- Vendo, Busco y Subasta. Pestañas Inicio (1 fila de subastas con pujas + 2 de últimos anuncios) · Vendo · Busco · Subastas; buscador y orden.
- Tarjeta sin imagen ni número; al pulsarla, detalle con cada objeto, su imagen debajo y «Encantamientos:» en lista. Subastas: historial de pujas.
- Recarga cada 5 s si hay subastas (30 s si no), también con el detalle abierto.
- El dueño edita o quita con lápiz y papelera (no una subasta con pujas).
- Número de anuncio `#0001` = id; el recibo lleva el mismo número. Sin nombre: nombre del objeto o «Anuncio #0007».
- Imagen por objeto, subida desde la web (tabla `imagenes`, ruta `/api/imagen/N`).
- Admins: «Probar correo» en el mercadillo. «Dar o quitar monedas» pasó a `admin.html` (Administración, en el menú del avatar solo para admins; `admin()` en `js/app.js`). El «Modo pruebas» se quitó (web y API); en la base de datos puede quedar el usuario `prueba` con sus anuncios.
- **Probado por el usuario:** venta (con el antiguo modo pruebas) y recibo por DM correctos.

### Recibos
- PNG con plantilla HTML+CSS (`api/src/recibo.js`), aprobado: «Compra»/«Subasta» para el comprador, «Venta» para el vendedor.
- Se mandan por DM a comprador y vendedor y al canal de registro (`RECIBOS_CANAL`), con las fotos de los objetos adjuntas.
- Solo a quien tiene `usuarios.correo` (solo Rolfin) le llegan también por correo; al conectar Discord su correo se borra y deja de recibirlos. El Gmail que envía es el del usuario y no se toca. Llegan: script de Google en el Gmail del usuario
  (`api/correo-gmail.gs`, secretos `CORREO_URL` y `CORREO_CLAVE`, ya configurados). La prueba al Gmail del usuario llegó.

### Bot en el privado: `/clear` (`api/src/comandos.js`)
- Solo admins. Respondiendo a un mensaje del bot con `/clear` borra ese (**probado por el usuario**). `/clear-chat` borra todos los del bot (sin probar); `/clear` suelto no hace nada porque lo usa Rythm.
- No es comando de Discord: el Cron lee cada minuto el DM de cada admin (tabla `bot_estado`, clave `dm_<id>`). Tarda hasta 1 min.
- El nombre del bot («Sugerencias») lo cambia el usuario en el portal de Discord (aplicación «gestor» → Bot → Username).

### Cuenta sin Discord de Rolfin (`api/src/cuentas.js`, `entrar.html`, `js/entrar.js`)
- Admin `847907957903851540`, nombre «Rolfin», correo guardado en la base de datos (no en el repositorio).
- **Probado:** Rolfin ya entró con su enlace y funciona; su contraseña es la que él puso. Conectar con Discord tardará (aún no tiene cuenta).
- Entra solo con su enlace `entrar.html#c=…` (código resumido en `bot_estado`, clave `enlace_<id>`), con correo y contraseña; la primera vez la contraseña que escriba queda como la suya. El enlace ya se generó y se le dio al usuario.
- Perfil: «Conectar con Discord» pasa todo a la cuenta de Discord con la que entre, que queda como admin (`bot_estado` `admin_cambio_<viejo>`, ver `listaAdmins`), y borra enlace, contraseña y sesiones.

### Perfil (`perfil.html`, `perfil()` en `js/app.js`, `paginaTienda` en `js/mercadillo.js`)
- Cartel (avatar, rol, resumen, monedas) y «tienda» con toldo: tus anuncios en pestañas Todo · Vendo · Busco · Subastas; se editan y quitan, no se crean. Solo ves tu perfil.
- Cabecera: logo CHARCALAND a la izquierda; el avatar abre un menú con Perfil y Salir. Subido (`df0ffce`), sin probar en la web real.

## Pendiente de revisar
1. **Correo a Rolfin:** el usuario le pidió que mire si le llega; falta su respuesta.
2. **Reintento del correo:** si el correo falla pero Discord no, no se reintenta. Explicado; no corre prisa.
3. **Conectar con Discord:** solo probado en local; Rolfin lo hará cuando tenga cuenta.
4. **Perfil y `/clear-chat`:** sin probar en la web real (editar y quitar desde la tienda, iconos, menú del avatar).
5. **Mercadillo con amigos reales:** el usuario lo probará con Rolfin.
6. **Sin modo pruebas, página de Administración e inicio nuevo** (logo grande, 3 tarjetas: próximo evento, última update, votación abierta; con sesión saluda y enseña Ir al mercadillo y Mi perfil): subidos, sin probar en la web real.

## Otras notas
- Las sesiones de pruebas locales usan `api/.dev.vars` (`PRUEBAS_LOCAL=1`, cabecera `X-Prueba-Usuario`); nunca se sube.
- `wrangler dev` deja procesos vivos: al terminar, parar los `node … wrangler … dev` de `Webpage/api` (si no, responde código viejo).
- La vista previa con datos inventados está en la configuración `previa-mercadillo` de `.claude/launch.json` (archivos en una carpeta temporal; puede haber que rehacerla).
- Sin subir al repositorio: `.claude/` y `ejemplos-recibo/` (imágenes de ejemplo del recibo).
