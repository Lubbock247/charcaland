# Por probar en la web

Cosas que Claude no puede probar solo (hace falta una cuenta real de Discord). Marca `[x]` lo que funcione y apunta lo que pase si falla.

## Requisito de estar en el Discord (12/11/2026)

**Ya comprobado por Claude:**
- La API rechaza sin sesión o con una sesión falsa: sugerencias, wikis y perfil.
- La web publicada en GitHub tiene la versión nueva.
- La ventana «Únete al Discord» se ve bien (forzada a mano en la web publicada).

**Contigo (estás en el servidor):**
- [ ] Al abrir la web con tu sesión antigua, te lleva sola a Discord a entrar otra vez.
- [ ] Discord te pide permiso para ver tus servidores; al aceptar vuelves a la web con sesión.
- [ ] **No** te sale la ventana «Únete al Discord».
- [ ] Puedes mandar una sugerencia y llega al canal.
- [ ] Puedes editar la wiki (eres admin).

**Con un amigo que NO esté en el servidor:**
- [ ] Entra con Discord y le sale la ventana «Únete al Discord».
- [ ] «Unirme al Discord» abre la invitación en otra pestaña.
- [ ] Tras unirse, «Ya me he unido, comprobar» quita la ventana.
- [ ] «Salir» cierra su sesión.
- [ ] Si intenta mandar una sugerencia sin estar en el servidor, no puede.

**Con un amigo que SÍ esté en el servidor:**
- [ ] Entra sin ver la ventana y puede mandar sugerencias.

## Notas
Apunta aquí lo que veas raro:

-

## Updates desde la web (12/11/2026)

**Ya comprobado por Claude:** las updates salen de la base de datos en la página Updates y en la portada; crear/borrar sin sesión se rechaza; el formulario se ve bien.

**Contigo (admin):**
- [ ] En Updates ves «+ Nueva update» y en cada tarjeta «Editar» y «Borrar».
- [ ] Creas una update y aparece arriba del todo; en Inicio sale como «Última update».
- [ ] La editas y se guarda el cambio.
- [ ] La borras (pide confirmación) y desaparece.

**Con un amigo (no admin):**
- [ ] Ve las updates pero no los botones.

## Eventos con pestañas, resumen y detalle (12/11/2026)

**Ya comprobado por Claude** (con eventos inventados, sin guardar): pestañas Inicio / Próximamente / Pasados, eventos sin fecha como «Planificado», pasados en gris, y al pulsar una tarjeta se abre el texto completo.

**Contigo (admin):**
- [ ] En la portada ya no sale «Unirme al Discord» si has entrado.
- [ ] Creas un evento con fecha futura: sale en Inicio y Próximamente, y en la portada.
- [ ] Creas uno sin fecha: sale solo en Próximamente como «Planificado».
- [ ] Creas uno con fecha pasada: sale en Pasados, en gris.
- [ ] Pulsas una tarjeta (evento o update): se abre con el texto completo; «← Volver» regresa.
- [ ] Editar y borrar desde la vista completa.

## Versiones, vista previa y votaciones (12/11/2026)

**Ya comprobado por Claude** (con datos inventados, sin guardar): el formulario sin paréntesis, con «Así se verá»; la versión propuesta es 1.0.0 y el título sale «1.0.0 - Nombre»; la votación se ve con barras y «tu voto». Las updates de ejemplo están borradas.

**Contigo (admin):**
- [ ] Creas la update 1.0.0; la siguiente te propone 1.0.1.
- [ ] Creas un evento con opciones (una por línea): sale «Votación» y aparece en la pestaña Inicio.
- [ ] Votas, cambias el voto y se actualiza.
- [ ] Marcas «Votación cerrada» al editar: ya no se puede votar y se resalta la ganadora.
- [ ] Si quitas una opción al editar, se pierden solo los votos de esa opción.

**Con un amigo:**
- [ ] Puede votar, pero no ve los botones de admin.

## Votaciones nuevas y limpieza (12/11/2026)

**Ya comprobado por Claude:** sin píldoras ni «Leer más»; la votación se ve en la lista con tu voto de «Cuando comienza el server» conservado; los interruptores del formulario se ven bien.

**Contigo:**
- [ ] Votas desde la lista sin abrir el evento; al pulsar otra vez tu opción, se quita el voto.
- [ ] Con «Varias respuestas», puedes marcar más de una.
- [ ] Con «Anónima», tú (admin) ves los nombres; un amigo no.
- [ ] Un evento sin fecha con «Mostrar en Inicio» sale en la pestaña Inicio.
- [ ] El botón «← Volver» se ve bien.

## Nuevo diseño de votación (12/11/2026)

**Ya comprobado por Claude** (sin sesión y con un ejemplo inventado): porcentajes, hasta 3 caras y «+N», círculos grises en la anónima, ventana «Votaciones» con nombres, «← Volver» dentro del cuadro. En tu votación anónima, sin sesión no sale el botón «Votaciones».

**Contigo (admin):**
- [ ] «Editar» y «Borrar» salen arriba a la derecha dentro del cuadro.
- [ ] En tu votación anónima te sale el botón «Votaciones» y ves los nombres.
- [ ] Las de varias respuestas tienen casilla cuadrada; las de una, redonda.

**Con un amigo:**
- [ ] En la anónima ve círculos grises y no le sale «Votaciones».
- [ ] En una pública ve las caras y el botón «Votaciones».
