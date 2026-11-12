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
