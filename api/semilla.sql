-- Páginas de ejemplo (PROVISIONAL). Se ejecuta una sola vez.
INSERT INTO paginas (seccion, categoria, slug, titulo, contenido, orden) VALUES
('mods','','expansiones-de-dominio','Expansiones de Dominio',
'# Expansiones de Dominio

Un mod propio del servidor. Cada jugador puede abrir un **dominio**: una cúpula negra que atrapa a todos los que estén cerca y los lleva a una arena aparte, con sus propias reglas y habilidades.

Elige una subpágina a la izquierda para ver cómo se usa y qué dominios hay.', 0);
INSERT INTO paginas (seccion, categoria, slug, titulo, contenido, padre_id, orden) VALUES
('mods','','como-se-usa','Cómo se usa',
'## El activador

Todos los jugadores tienen un **activador** que no se puede soltar.

- Mayús + clic izquierdo abre el dominio del primer hueco.
- Mayús + clic derecho abre el del segundo.
- Clic derecho normal: abre la explicación o, si tienes un dominio abierto, lo cierra.

## Niveles

El dominio se fabrica en nivel 1 y se mejora con pergaminos de mejora. El nivel N desbloquea las habilidades 1 a N.', (SELECT id FROM paginas WHERE seccion='mods' AND slug='expansiones-de-dominio'), 1),
('mods','','black-hand-of-catastrophe','Black Hand of Catastrophe',
'## Domain Expansion, Black Hand of Catastrophe

Un dragón blanco rodea la arena, el suelo es agua roja y decenas de manos de piedra negra avanzan hacia los enemigos.

### Habilidades

1. **Despliegue de manos**
2. **Hand Swap**
3. **Hand Swarm**
4. **Explosive Symphony**', (SELECT id FROM paginas WHERE seccion='mods' AND slug='expansiones-de-dominio'), 2),
('mods','','throne-of-the-last-hope','Throne of the Last Hope',
'## Domain Expansion: Throne of the Last Hope

Dominio de jefe, solo para eventos. Quien lo usa se convierte en el jefe, y la arena es una estructura construida a mano.', (SELECT id FROM paginas WHERE seccion='mods' AND slug='expansiones-de-dominio'), 3);
INSERT INTO paginas (seccion, categoria, slug, titulo, contenido, orden) VALUES
('lore','mundo','charcaland','Charcaland',
'# Charcaland

PROVISIONAL: aquí empieza la historia del mundo. Solo los administradores pueden editar el lore del mundo.', 0);
