-- Contenido provisional de las wikis (se ejecuta una vez)
DELETE FROM paginas WHERE seccion='mods' AND slug IN ('como-se-usa','black-hand-of-catastrophe','throne-of-the-last-hope');
UPDATE paginas SET contenido=':::caja Expansiones de Dominio
Tipo: Mod propio de Charcaland
Versión: Minecraft 1.20.1 (Forge)
Necesita: Iron''s Spells ''n Spellbooks
Dominios: Black Hand of Catastrophe, Throne of the Last Hope
:::
Las **Expansiones de Dominio** son un mod hecho para este servidor. Con él, cualquier jugador puede abrir un *dominio*: una cúpula negra que atrapa a todos los que estén cerca y los lleva a una arena aparte, con su propio suelo, cielo, música y habilidades.

Esta wiki explica el mod en tres páginas:

- [[Qué son y cómo se usan]]: cómo se abre un dominio, qué pasa dentro y los tipos que hay.
- [[Crafteo y mejora]]: cómo conseguir un dominio y subirlo de nivel.
- [[Expansiones]]: todos los dominios que existen, con sus habilidades.

## Si hay algo que no se entiende

Si algún apartado no queda claro, pídelo en la página de **Sugerencias** y se amplía esta wiki.', actualizado=datetime('now') WHERE seccion='mods' AND slug='expansiones-de-dominio';
INSERT INTO paginas (seccion, categoria, slug, titulo, contenido, padre_id, orden) VALUES ('mods','','que-son-y-como-se-usan','Qué son y cómo se usan','Una expansión de dominio es un poder que se abre en el lugar donde estás. Al activarlo sube una **cúpula negra** a tu alrededor, atrapa a todos los que estén dentro (jugadores y mobs, aliados incluidos, para que sirva contra jefes) y los lleva a una **arena aparte**. Cuando termina, cada uno vuelve a donde estaba.

## El activador

Cada jugador tiene un **activador** que no se puede soltar ni guardar. Con él se controla todo:

- **Mayús + clic izquierdo**: abre el dominio del primer hueco.
- **Mayús + clic derecho**: abre el del segundo hueco.
- **Clic derecho normal**: abre la explicación o, si tienes un dominio abierto, lo cierra.

Los dominios se equipan en el espacio *domain* de Curios, que tiene 2 huecos. Puedes llevar como máximo 2 dominios equipados, pero solo uno activo a la vez.

## Abrir el dominio

Al activarlo te quedas quieto unos 2,5 segundos con los brazos a la altura de los hombros y las manos juntas, mientras la cúpula sube desde el suelo hasta cerrarse en lo alto. A ti y a quien lo vea les aparece en pantalla el nombre del dominio. Después entras a la arena.

## Dentro del dominio

- **Maná**: abrir el dominio cuesta maná, y mantenerlo abierto cuesta más cada segundo. El coste sube con el nivel. Si no puedes pagarlo, el dominio se acaba. En creativo es gratis.
- **Duración**: dura un mínimo (30 segundos en el caso de [[Expansiones|Black Hand]]) y después sigue mientras puedas pagar el maná.
- **Habilidades**: un dominio de nivel N desbloquea sus habilidades 1 a N, que ocupan las primeras ranuras de tu barra mientras dura.
- **Bloques**: dentro de la arena no se pueden romper ni poner bloques (salvo en creativo) y las explosiones no rompen nada.
- **Sonido**: se silencia todo salvo la música del dominio.

## Cómo termina

El dominio de cada jugador termina si:

- Se le acaba el tiempo o no puede pagar el maná.
- Lo cierra con clic derecho.
- Muere o se desconecta.
- Se rompe la cúpula: se puede romper a golpes y con hechizos. Al romperse, todos vuelven a su sitio.

Si alguien muere dentro, lo que suelta se queda en la arena y al acabar aparece en el centro del lugar donde se abrió. Tu barra de habilidades guardada no se pierde.

## Después: burnout

Cuando termina, durante un tiempo (20 segundos en [[Expansiones|Black Hand]]) no puedes lanzar hechizos ni usar nada que requiera maná, aunque el maná sí se regenera. Además el dominio tiene una **recarga** antes de poder volver a abrirlo.

## Tipos de dominio

| Tipo | Cómo funciona | Estado |
|---|---|---|
| Con barrera | Cúpula, arena aparte y efectos en todo el campo, como Black Hand | Disponible |
| Abierto | Sin cúpula ni viaje: da una mejora en el mundo normal y sus efectos son sobre quien lo usa. Más flojo | Planeado |
| De jefe | Para combates contra jefes que monta un administrador en un evento. Quien lo usa se convierte en el jefe. Sin maná, sin recarga y solo acaba si el jefe muere o lo cierra | Disponible |

En un combate contra un jefe los jugadores no pueden desplegar su dominio de barrera.

## Choques de dominios

Si abres tu dominio dentro del de otro jugador, la arena se parte: cada mitad con su aspecto y sus efectos pasivos, aunque ambos pueden usar sus habilidades en toda la arena. Cada uno paga su maná y tiene su propia duración. Si uno acaba antes, su mitad pasa al otro. Si se rompe la cúpula, acaban los dos. Ahora mismo caben 2 dominios a la vez; más adelante serán 3 y 4.

## Morir con el dominio equipado

Los dominios se pueden encantar con **Soulbound** en un yunque para que sigan equipados al morir. Sin encantar, se sueltan como cualquier objeto.

Ver también: [[Crafteo y mejora]] · [[Expansiones]]',(SELECT id FROM paginas WHERE seccion='mods' AND slug='expansiones-de-dominio'),1);
INSERT INTO paginas (seccion, categoria, slug, titulo, contenido, padre_id, orden) VALUES ('mods','','crafteo-y-mejora','Crafteo y mejora','Los dominios no se encuentran por el mundo: se **fabrican** en una mesa de crafteo. Primero hace falta un *Domain Core*, y con él y unos pergaminos sale el dominio.

## Domain Core

El **Domain Core** es una perla de ender azul y su receta es pública:

- **Centro**: una perla de ender.
- **Las 4 esquinas**: esmeraldas.
- **Los otros 4 huecos**: diamantes.

## Fabricar un dominio

Las **recetas de cada dominio son secretas**: no salen en el libro de recetas ni en JEI, y hay que descubrirlas. Lo único que se sabe es cómo funcionan:

- El **Domain Core** va en el **centro** de la mesa.
- **Cuatro pergaminos de hechizo de Iron''s Spells** van en cruz alrededor del core (arriba, abajo, izquierda y derecha).
- La **escuela** de los pergaminos decide qué dominio sale. Cada dominio pide una combinación distinta de escuelas.
- El orden en la cruz no importa, y vale un pergamino de cualquier nivel o rareza.

Los dominios de jefe no se fabrican: solo los da un administrador.

## Pergamino de mejora

Para subir de nivel hace falta el **pergamino de mejora**. Es genérico, sirve para cualquier dominio y se hace con **5 pergaminos de hechizo de una misma escuela**, sea cual sea.

## Subir de nivel

Un dominio se fabrica en **nivel 1** y se mejora también en la mesa de crafteo, conservando sus encantamientos:

| Nivel | Cómo se consigue |
|---|---|
| 1 | Se fabrica (ver arriba) |
| 2 | El dominio + 1 pergamino de mejora |
| 3 | El dominio de nivel 2 + 4 diamantes |
| 4 | El dominio de nivel 3 en el centro + un pergamino de mejora en cada una de las 4 esquinas |
| 5 | El dominio rodeado por 8 pergaminos de mejora |

No todos los dominios llegan al nivel 5. En [[Expansiones]] se indica el máximo de cada uno.

Cada nivel desbloquea una habilidad más y sube el coste de maná.

Ver también: [[Qué son y cómo se usan]] · [[Expansiones]]',(SELECT id FROM paginas WHERE seccion='mods' AND slug='expansiones-de-dominio'),2);
INSERT INTO paginas (seccion, categoria, slug, titulo, contenido, padre_id, orden) VALUES ('mods','','expansiones','Expansiones','Estos son todos los dominios que existen ahora mismo. Los valores marcados como *provisionales* pueden cambiar mientras se prueba el mod.

## Black Hand of Catastrophe

:::caja Black Hand of Catastrophe
Nombre: Domain Expansion, Black Hand of Catastrophe
Tipo: Con barrera
Niveles: 4
Maná al abrir: 100 / 200 / 500 / 600
Maná por segundo: 5 / 10 / 20 / 25
Duración mínima: 30 s
Recarga: 60 s
Burnout: 20 s
Cúpula: 500 de vida
:::
Un dominio propio de Charcaland, basado en una habilidad de D&D. Dentro de la arena:

- Un **dragón blanco** rodea el campo en anillo y un **ojo morado** se ve en lo más alto.
- El suelo es una capa de **agua roja** sobre la que se anda y el cielo es nocturno y estrellado, sin luna.
- Hay **74 cadáveres** acumulados hacia los bordes, con armadura de netherite oscura.
- Decenas de **manos de piedra negra** con runas moradas avanzan hacia los enemigos. Empiezan 15, aparece 1 nueva cada 5 segundos y el máximo es 24. Las más viejas se hunden en un sello.

### Habilidades

| Nivel | Habilidad | Qué hace |
|---|---|---|
| 1 | Despliegue de manos | Despliega 6, 10, 13 o 20 manos según el nivel. Hasta 9 salen alrededor de ti y el resto, por la arena. Bloquean proyectiles y magia enemigos (los tuyos las atraviesan) y explotan al contacto |
| 2 | Hand Swap | Intercambia tu posición con la mano a la que miras |
| 3 | Hand Swarm | Eliges una entidad y durante 8 segundos todas las manos van hacia ella |
| 4 | Explosive Symphony | Explotan todas las manos, una tras otra, con más daño y mucho más radio |

Las manos explotan sin romper bloques y no dañan al lanzador, sus mascotas ni su equipo. Las recargas de las habilidades son provisionales.

## Throne of the Last Hope

:::caja Throne of the Last Hope
Nombre: Domain Expansion: Throne of the Last Hope
Tipo: De jefe
Niveles: 5
Se consigue: lo da un administrador
Maná: no gasta
Recarga y burnout: ninguno
Duración: hasta que el jefe muere o lo cierra
Estado: en desarrollo
:::
Inspirado en Liliana, de *Magic: The Gathering*, y sus ejércitos de muertos. Es un dominio **de jefe**: solo lo usan los jefes de los eventos, y la arena es una **estructura construida a mano** de 90 × 40 × 90 bloques, con el jefe en el bloque central. Su cúpula no se rompe, salvo por jugadores en creativo.

De vez en cuando salen zombies aliados del suelo, y mientras dura el dominio los hechizos de invocar zombies del lanzador suben de nivel.

### Habilidades

| Nivel | Habilidad | Qué hace |
|---|---|---|
| 1 | Invocar zombies | Levanta 6, 8, 10 o 12 zombies armados alrededor del lanzador, según el nivel |
| 2 | Vestido de Liliana | Se pone y se quita. Cambia el aspecto del lanzador y le da más armadura, resistencia mágica y poder de invocación |
| 3 | Juggernauts | Invoca 2 enormes moles de armadura negra, lentas y con mucha vida |
| 4 | Army of the Damned | Una oleada enorme de zombies y juggernauts surge del suelo, carga y se deshace a los 20 segundos |
| 5 | Velo de Cadenas | Pasiva: sus hechizos no gastan maná y hacen más daño, pero cada uno le quita algo de vida |

Estas habilidades aún se están probando.

Ver también: [[Qué son y cómo se usan]] · [[Crafteo y mejora]]',(SELECT id FROM paginas WHERE seccion='mods' AND slug='expansiones-de-dominio'),3);
UPDATE paginas SET contenido='Aquí empieza la historia del mundo de Charcaland. **Provisional**: este texto lo reemplazarán los administradores.

Solo los administradores pueden editar el lore del mundo. Si quieres añadir tu personaje, ve a *Personajes* en el menú de la izquierda.' WHERE seccion='lore' AND slug='charcaland';
