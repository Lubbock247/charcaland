# Traspaso: mercadillo, bot y cuenta sin Discord (13/11/2026)

Para seguir en un chat nuevo. Lee antes `CLAUDE.md` y `plan-mercadillo.md`.
Al terminar de leerlo, este archivo se puede borrar (pregunta al usuario antes de hacer commit).

## Estado: todo subido y funcionando en la web
Último commit: `28813a0`. API desplegada en Cloudflare. Base de datos real con todas las tablas
(`mercadillo.sql`, `mercadillo2.sql`, `mercadillo3.sql`, `cuentas.sql` ya aplicados en remoto).

### Mercadillo (`mercadillo.html`, `js/mercadillo.js`, `api/src/mercadillo.js`)
- Vendo, Busco y Subasta. Pestañas Inicio (1 fila de subastas con pujas + 2 de últimos anuncios) · Vendo · Busco · Subastas; buscador y orden.
- Tarjeta sin imagen ni número; al pulsarla, detalle con cada objeto, su imagen debajo y «Encantamientos:» en lista. Subastas: historial de pujas.
- Recarga cada 5 s si hay subastas (30 s si no), también con el detalle abierto.
- El dueño edita o quita con lápiz y papelera (no una subasta con pujas).
- Número de anuncio `#0001` = id; el recibo lleva el mismo número. Sin nombre: nombre del objeto o «Anuncio #0007».
- Imagen por objeto, subida desde la web (tabla `imagenes`, ruta `/api/imagen/N`).
- Admins: «Modo pruebas» (actúa como «Jugador de prueba», cabecera `X-Como: prueba`), «Dar o quitar monedas» y «Probar correo».
- El usuario lo ha probado: venta con modo pruebas y recibo por DM correctos.

### Recibos
- PNG con plantilla HTML+CSS (`api/src/recibo.js`), aprobado: «Compra»/«Subasta» para el comprador, «Venta» para el vendedor.
- Se mandan por DM a comprador y vendedor y al canal de registro (`RECIBOS_CANAL`), con las fotos de los objetos adjuntas.
- A quien tiene `usuarios.correo` le llegan también por correo: script de Google en el Gmail del usuario
  (`api/correo-gmail.gs`, secretos `CORREO_URL` y `CORREO_CLAVE`, ya configurados). La prueba al Gmail del usuario llegó.

### Bot en el privado: `/clear` (`api/src/comandos.js`)
- Solo admins. Respondiendo a un mensaje del bot con `/clear` borra ese; sin responder, borra todos los del bot.
- No es comando de Discord: el Cron lee cada minuto el DM de cada admin (tabla `bot_estado`, clave `dm_<id>`). Tarda hasta 1 min.
- El nombre del bot («Sugerencias») lo cambia el usuario en el portal de Discord (aplicación «gestor» → Bot → Username).

### Cuenta sin Discord de Rolfin (`api/src/cuentas.js`, `entrar.html`, `js/entrar.js`)
- Admin `847907957903851540`, nombre «Rolfin», correo guardado en la base de datos (no en el repositorio).
- Entra solo con su enlace `entrar.html#c=…` (código resumido en `bot_estado`, clave `enlace_<id>`), con correo y contraseña; la primera vez la contraseña que escriba queda como la suya. El enlace ya se generó y se le dio al usuario.
- Perfil: «Conectar con Discord» pasa todo a la cuenta de Discord con la que entre, que queda como admin (`bot_estado` `admin_cambio_<viejo>`, ver `listaAdmins`), y borra enlace, contraseña y sesiones.

## Pendiente de revisar
1. **Correo a Rolfin:** comprobar que le llegan los recibos (aún no ha comprado ni vendido). Puede caer en spam.
   Opción ofrecida: que «Probar correo» deje elegir destinatario para mandarle una prueba (solo con permiso del usuario).
2. **Reintento del correo:** si el correo falla pero Discord no, el recibo queda como enviado y el correo no se reintenta.
3. **Rolfin aún no ha entrado** con su enlace. «Conectar con Discord» solo está probado en local (simulado).
4. **Cambiar contraseña** desde el perfil: no existe; la contraseña inicial pasó por el chat. Ofrecido, sin hacer.
5. Lo de `por-probar.md` (mercadillo con amigos reales, `/clear`).

## Otras notas
- Las sesiones de pruebas locales usan `api/.dev.vars` (`PRUEBAS_LOCAL=1`, cabecera `X-Prueba-Usuario`); nunca se sube.
- `wrangler dev` deja procesos vivos: al terminar, parar los `node … wrangler … dev` de `Webpage/api` (si no, responde código viejo).
- La vista previa con datos inventados está en la configuración `previa-mercadillo` de `.claude/launch.json` (archivos en una carpeta temporal; puede haber que rehacerla).
- Sin subir al repositorio: `.claude/` y `ejemplos-recibo/` (imágenes de ejemplo del recibo).
