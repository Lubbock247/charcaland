-- Reorganización de la wiki de Expansiones (se ejecuta una vez)
UPDATE paginas SET contenido=':::caja Expansiones de Dominio
Tipo: Mod propio de Charcaland
Versión: Minecraft 1.20.1 (Forge)
Necesita: Iron''s Spells ''n Spellbooks
Dominios: 3
:::
Las **Expansiones de Dominio** son un mod hecho para este servidor. Con él, cualquier jugador puede abrir un *dominio*: un poder que cambia el combate a su alrededor. Los de barrera levantan una cúpula negra que atrapa a todos los que estén cerca y los lleva a una arena aparte, con su propio suelo, cielo, música y habilidades.

- [[Cómo se usan]]: el activador, qué pasa dentro de un dominio y los tipos que hay.
- [[Crafteo y mejora]]: cómo conseguir un dominio y subirlo de nivel.
- [[Expansiones]]: todos los dominios que existen, con sus habilidades.

Si algo no se entiende, pídelo en **Sugerencias** y se amplía esta wiki.', icono='sparkles', actualizado=datetime('now') WHERE seccion='mods' AND slug='expansiones-de-dominio';
UPDATE paginas SET titulo='Cómo se usan', slug='como-se-usan', contenido='Una expansión de dominio es un poder que se abre en el lugar donde estás. Los dominios **de barrera** levantan una **cúpula negra** a tu alrededor, atrapan a todos los que estén dentro (jugadores y mobs, aliados incluidos, para que sirva contra jefes) y los llevan a una **arena aparte**. Cuando termina, cada uno vuelve a donde estaba.

# El activador

Cada jugador tiene un **activador** que no se puede soltar ni guardar. Con él se controla todo:

- **Mayús + clic izquierdo**: abre el dominio del primer hueco.
- **Mayús + clic derecho**: abre el del segundo hueco.
- **Clic derecho normal**: abre la explicación o, si tienes un dominio abierto, lo cierra.

Los dominios se equipan en el espacio *domain* de Curios, que tiene 2 huecos. Puedes llevar como máximo 2 dominios equipados, pero solo uno activo a la vez.

# Abrir el dominio

Al activarlo te quedas quieto unos 2,5 segundos con los brazos a la altura de los hombros y las manos juntas, mientras la cúpula sube desde el suelo hasta cerrarse en lo alto. A ti y a quien lo vea les aparece en pantalla el nombre del dominio. Después entras a la arena.

# Dentro del dominio

- **Maná**: abrir el dominio cuesta maná, y mantenerlo abierto cuesta más cada segundo. El coste sube con el nivel. Si no puedes pagarlo, el dominio se acaba. En creativo es gratis.
- **Duración**: dura un mínimo (30 segundos en [[Black Hand of Catastrophe|Black Hand]]) y después sigue mientras puedas pagar el maná.
- **Habilidades**: un dominio de nivel N desbloquea sus habilidades 1 a N, que ocupan las primeras ranuras de tu barra mientras dura.
- **Bloques**: dentro de la arena no se pueden romper ni poner bloques (salvo en creativo) y las explosiones no rompen nada.
- **Sonido**: se silencia todo salvo la música del dominio.

# Cómo termina

El dominio de cada jugador termina si:

- Se le acaba el tiempo o no puede pagar el maná.
- Lo cierra con clic derecho.
- Muere o se desconecta.
- Se rompe la cúpula: se puede romper a golpes y con hechizos. Al romperse, todos vuelven a su sitio.

Si alguien muere dentro, lo que suelta se queda en la arena y al acabar aparece en el centro del lugar donde se abrió. Tu barra de habilidades guardada no se pierde.

# Después: burnout

Cuando termina, durante un tiempo (20 segundos en [[Black Hand of Catastrophe|Black Hand]]) no puedes lanzar hechizos ni usar nada que requiera maná, aunque el maná sí se regenera. Además el dominio tiene una **recarga** antes de poder volver a abrirlo.

# Tipos de dominio

| Tipo | Cómo funciona | Ejemplo |
|---|---|---|
| De barrera | Cúpula, arena aparte y efectos en todo el campo | [[Black Hand of Catastrophe]] |
| Abierto | Sin cúpula ni viaje: se abre en cualquier sitio y da poderes a quien lo usa. Más flojo | [[Esdeath]] (en desarrollo) |
| De jefe | Para combates contra jefes en eventos. Quien lo usa se convierte en el jefe: sin maná, sin recarga y solo acaba si el jefe muere o lo cierra | [[Throne of the Last Hope]] |

En un combate contra un jefe los jugadores no pueden desplegar su dominio de barrera.

# Choques de dominios

Si abres tu dominio dentro del de otro jugador, la arena se parte: cada mitad con su aspecto y sus efectos pasivos, aunque ambos pueden usar sus habilidades en toda la arena. Cada uno paga su maná y tiene su propia duración. Si uno acaba antes, su mitad pasa al otro. Si se rompe la cúpula, acaban los dos. Ahora mismo caben 2 dominios a la vez; más adelante serán 3 y 4.

# Morir con el dominio equipado

Los dominios se pueden encantar con **Soulbound** en un yunque para que sigan equipados al morir. Sin encantar, se sueltan como cualquier objeto.', orden=1, actualizado=datetime('now') WHERE seccion='mods' AND slug='que-son-y-como-se-usan';
UPDATE paginas SET contenido='Los dominios no se encuentran por el mundo: se **fabrican** en una mesa de crafteo. Primero hace falta un *Domain Core*, y con él y unos pergaminos sale el dominio.

# Domain Core

El **Domain Core** es una perla de ender azul y su receta es pública:

- **Centro**: una perla de ender.
- **Las 4 esquinas**: esmeraldas.
- **Los otros 4 huecos**: diamantes.

# Fabricar un dominio

Las **recetas de cada dominio son secretas**: no salen en el libro de recetas ni en JEI, y hay que descubrirlas. Lo único que se sabe es cómo funcionan:

- El **Domain Core** va en el **centro** de la mesa.
- **Cuatro pergaminos de hechizo de Iron''s Spells** van en cruz alrededor del core (arriba, abajo, izquierda y derecha).
- La **escuela** de los pergaminos decide qué dominio sale. Cada dominio pide una combinación distinta de escuelas.
- El orden en la cruz no importa, y vale un pergamino de cualquier nivel o rareza.

Los dominios de jefe no se fabrican: solo los da un administrador.

# Pergamino de mejora

Para subir de nivel hace falta el **pergamino de mejora**. Es genérico, sirve para cualquier dominio y se hace con **5 pergaminos de hechizo de una misma escuela**, sea cual sea.

# Subir de nivel

Un dominio se fabrica en **nivel 1** y se mejora también en la mesa de crafteo, conservando sus encantamientos:

| Nivel | Cómo se consigue |
|---|---|
| 1 | Se fabrica (ver arriba) |
| 2 | El dominio + 1 pergamino de mejora |
| 3 | El dominio de nivel 2 + 4 diamantes |
| 4 | El dominio de nivel 3 en el centro + un pergamino de mejora en cada una de las 4 esquinas |
| 5 | El dominio rodeado por 8 pergaminos de mejora |

No todos los dominios llegan al nivel 5: la caja de datos de cada dominio indica su máximo. Cada nivel desbloquea una habilidad más y sube el coste de maná.', orden=2, actualizado=datetime('now') WHERE seccion='mods' AND slug='crafteo-y-mejora';
UPDATE paginas SET contenido='', orden=3, actualizado=datetime('now') WHERE seccion='mods' AND slug='expansiones';
INSERT INTO paginas (seccion, categoria, slug, titulo, contenido, padre_id, orden) VALUES ('mods','','black-hand-of-catastrophe','Black Hand of Catastrophe',':::caja Black Hand of Catastrophe
Nombre: Domain Expansion, Black Hand of Catastrophe
Tipo: De barrera
Niveles: 4
Maná al abrir: 100 / 200 / 500 / 600
Maná por segundo: 5 / 10 / 20 / 25
Duración mínima: 30 s
Recarga: 60 s
Burnout: 20 s
Cúpula: 500 de vida
:::
Un dominio propio de Charcaland, basado en una habilidad de D&D. Un dragón blanco rodea la arena, el suelo es agua roja y decenas de manos de piedra negra avanzan hacia los enemigos.

# La arena

- Un **dragón blanco** rodea el campo en anillo y un **ojo morado** se ve en lo más alto.
- El suelo es una capa de **agua roja** sobre la que se anda y el cielo es nocturno y estrellado, sin luna.
- Hay **74 cadáveres** acumulados hacia los bordes, con armadura de netherite oscura.

# Las manos

Manos de piedra negra con runas moradas que avanzan hacia los enemigos y explotan al tocarlos. Empiezan 15, aparece 1 nueva cada 5 segundos y el máximo es 24; las más viejas se hunden en un sello. Explotan sin romper bloques y no dañan al lanzador, sus mascotas ni su equipo.

# Habilidades

:::habilidades
Nivel 1 | Despliegue de manos | Despliega 6, 10, 13 o 20 manos según el nivel, alrededor de ti y por la arena. Bloquean proyectiles y magia enemigos y explotan al contacto
Nivel 2 | Hand Swap | Intercambia tu posición con la mano a la que miras
Nivel 3 | Hand Swarm | Eliges una entidad y durante 8 segundos todas las manos van hacia ella
Nivel 4 | Explosive Symphony | Explotan todas las manos, una tras otra, con más daño y mucho más radio
:::

Las recargas de las habilidades son provisionales.',(SELECT id FROM paginas WHERE seccion='mods' AND slug='expansiones'),0);
INSERT INTO paginas (seccion, categoria, slug, titulo, contenido, padre_id, orden) VALUES ('mods','','throne-of-the-last-hope','Throne of the Last Hope',':::caja Throne of the Last Hope
Nombre: Domain Expansion: Throne of the Last Hope
Tipo: De jefe
Niveles: 5
Se consigue: lo da un administrador
Maná: no gasta
Recarga y burnout: ninguno
Duración: hasta que el jefe muere o lo cierra
:::
Inspirado en Liliana, de *Magic: The Gathering*, y sus ejércitos de muertos. Es un dominio **de jefe**: solo lo usan los jefes de los eventos. Su cúpula no se puede romper.

# La arena

Una **estructura construida a mano** de 90 × 40 × 90 bloques, con el jefe en el bloque central. Los pilares se oscurecen hasta el negro puro en lo alto y el cielo es completamente negro.

# Pasivas

- Cada 4 segundos sale del suelo un **zombie aliado** cerca del jefe, hasta 20 a la vez.
- El hechizo **Raise Dead** del jefe sube de nivel según el nivel del dominio, y sus invocaciones salen como zombies del trono, con espada y escudo o con arco.

# Habilidades

:::habilidades
Nivel 1 | Invocar zombies | Levanta 6, 8, 10 o 12 zombies armados en corro alrededor del jefe. Uno de cada cinco es arquero
Nivel 2 | Vestido de Liliana | Se pone y se quita. Cambia el aspecto del jefe y le da más armadura, resistencia mágica y poder de invocación
Nivel 3 | Juggernauts | Dos zombies enormes con armadura de placas y mandoble salen del suelo a los lados del jefe. Sus golpes lanzan por los aires
Nivel 4 | Army of the Damned | 15 zombies y 2 juggernauts surgen a la vez delante del jefe, cargan contra el enemigo más cercano y se deshacen a los 20 segundos
Nivel 5 | Velo de Cadenas | Pasiva: sus hechizos no gastan maná y hacen un 30 % más de daño, pero cada uno le quita vida según lo que costaría
:::',(SELECT id FROM paginas WHERE seccion='mods' AND slug='expansiones'),1);
INSERT INTO paginas (seccion, categoria, slug, titulo, contenido, padre_id, orden) VALUES ('mods','','esdeath','Esdeath',':::caja Esdeath
Nombre: Domain Expansion: Demon''s Extract (provisional)
Tipo: Abierto
Niveles: 5
Estado: en desarrollo
:::
Inspirado en Esdeath, de *Akame ga Kill*, y su dominio del hielo. Es un dominio **abierto**: no tiene cúpula ni arena, se abre en cualquier sitio y da sus poderes a quien lo usa.

**Este dominio aún se está haciendo.** Lo que pone aquí puede cambiar.

# Cómo funciona

- Se abre como los demás, con el activador. Mientras está abierto, tu maná máximo baja.
- El activador se cambia por un **estoque**, con el que se combate y se bloquea.
- **Mayús + clic izquierdo** con el estoque levanta un **pilar de hielo** (3 cargas). **Mayús + clic derecho** cierra el dominio.
- Mientras está abierto no te afecta la congelación.

# Habilidades previstas

:::habilidades
Nivel 1 | Proyectil de hielo | Al activarlo, tus cortes lanzan medias lunas de hielo
Nivel 2 | Picos de hielo | Por hacer
Nivel 3 | Por decidir | Por hacer
Nivel 4 | Weiss Schnabel | Por hacer
Nivel 5 | Tormenta | Por hacer
:::',(SELECT id FROM paginas WHERE seccion='mods' AND slug='expansiones'),2);
