# Ajustes de pulido — reunión

> Rama: `fix/ajustes-reunion` (sale de `develop` en `15ee337`)
> Seis puntos acordados en reunión. Se implementan **de uno en uno**, un commit por punto.

Leyenda: ⬜ Pendiente · 🟨 En progreso · ✅ Hecho

| #   | Punto                                 | Tipo   | Dónde vive                                          | Estado |
| --- | ------------------------------------- | ------ | --------------------------------------------------- | :----: |
| 1   | Botón de copiar código de sala        | Falta  | `pages/Lobby.tsx` (RoomPanel) + i18n                |   ✅   |
| 2   | Pulir interfaz del chat de usuarios   | Mejora | `shared/ChatWindow.tsx`                             |   ✅   |
| 3   | Animación al recoger un coleccionable | Mejora | `game/scenes/GameScene.tsx` (`Collectibles`)        |   🟨   |
| 4   | Cámara que se mete en los edificios   | Bug    | `game/scenes/GameScene.tsx` (cámara del escondido)  |   🟨   |
| 5   | Transición andar ↔ idle               | Bug/UX | `game/scenes/GameScene.tsx` (`Units`, morph shader) |   🟨   |
| 6   | El sol no se renderiza bien en Home   | Bug    | `features/home-3d/cameraPoses.ts`                   |   🟨   |

---

## 1. Botón de copiar código de sala

**Situación.** `Lobby.tsx:277-287` pinta el código de sala como texto plano. No hay una
sola llamada al portapapeles en todo el frontend: el botón es nuevo de cero.

**Qué se hace.**

- Botón de copiar pegado al código, con icono de `lucide-react` (`Copy` → `Check`).
- `navigator.clipboard.writeText`, con reserva por `document.execCommand` para contextos
  sin HTTPS (la app se prueba en red local).
- Confirmación visual de ~2 s en el propio botón + `aria-live` para lectores de pantalla.
- Claves nuevas en `room` de `es/en/fr.json`: `copyCode`, `codeCopied`.
- Se aprovecha `playSfx` si hay un sonido de interfaz que encaje.

**Riesgo.** Ninguno. Cambio aislado a un panel.

**Hecho.** Botón junto al código, con `Copy` → `Check` al acertar. El rótulo de encima
hace de acuse de recibo (copiado / no se ha podido copiar) en vez de añadir una línea que
desplace el panel, y lleva `aria-live` para que también se anuncie. El código se queda
como texto suelto, no como etiqueta del botón, para poder seleccionarlo a mano si el
portapapeles falla. Sin sonido: hoy ningún botón de la interfaz suena — eso es la issue
#86 (`feat/ui-sounds`) y no toca adelantarlo aquí.

---

## 2. Pulir la interfaz del chat

**Situación.** `ChatWindow.tsx` (250 líneas) ya tiene lo esencial: burbujas propias/ajenas,
hora, contador de caracteres, estados de carga y error. Lo que falta es lectura.

**Qué se hace** — pulido, sin tocar la lógica de socket ni el `mergeMessages`:

- Agrupar mensajes seguidos del mismo autor: hoy cada mensaje repite nombre y hora.
- Separadores de día cuando la conversación cruza fechas.
- Autoscroll solo si ya estabas abajo — ahora `scrollIntoView` te arranca de la lectura
  cada vez que llega un mensaje.
- El `textarea` crece con el contenido en vez de quedarse en dos filas fijas.
- Contador de caracteres solo cuando te acercas al límite, no siempre.
- Repaso de contraste y de área táctil en móvil.

**Riesgo.** Bajo. Es el mismo componente para chat directo, de sala y de escuadra
(`DirectChatDialog`, `GroupChatDock`), así que se revisan los tres sitios.

**Hecho.** Los seis puntos, sin tocar sockets ni `mergeMessages`. Dos apuntes sobre
decisiones que no estaban en el plan:

- Dejar de arrastrar el scroll abría un agujero — un mensaje que llega mientras lees más
  arriba pasaría desapercibido. Se añade un aviso flotante "MENSAJES NUEVOS" que baja al
  final. Va posicionado en absoluto sobre la lista: como hermano en el flujo, aparecer y
  desaparecer movería el panel entero.
- Al enviar sí se baja siempre, aunque estuvieras leyendo arriba: avisarte de tu propio
  mensaje no tiene sentido.

Claves nuevas en `chat`: `today`, `yesterday`, `newMessages`. Los `Intl.DateTimeFormat`
pasan a memorizarse: antes se construía uno nuevo por mensaje y por render.

---

## 3. Animación al recoger un coleccionable

**Situación.** El servidor deja de mandar la célula en el snapshot, `gameStore` reemplaza
el array y React desmonta el `<group>`: desaparece en un fotograma. El sonido
(`playSfx("collect")`, `gameStore.ts:157`) ya está; lo que falta es lo visual.

**Qué se hace.**

- `Collectibles` compara el array nuevo con el anterior y guarda las que se han ido en una
  lista local de "recogidas", con su instante de salida.
- Durante ~0,45 s: la célula sube, gira más rápido, se agranda y se desvanece; el haz se
  contrae y da un destello. Curva de salida suave, no lineal.
- Al terminar, se descarta. Material clonado por célula saliente para poder bajar el alfa
  sin tocar el material compartido del GLTF (y se libera al acabar).

**Riesgo.** Bajo, pero hay que cuidar la limpieza de materiales para no filtrar memoria en
partidas largas.

**Hecho** (falta verlo en una partida real). Componente `VanishingCell` propio: sube 0.4
en 450 ms con salida cúbica, gira acelerado, se agranda un 70 % y se apaga; el haz se
cierra y da un destello a mitad de camino. Cada célula saliente clona sus dos materiales
y los libera al desmontarse — bajarle el alfa al del GLTF apagaría todas las demás.

Dos cosas que aparecieron al implementarlo:

- La lista se vacía de golpe también al acabar la ronda y al salir de la partida
  (`round: null`). Sin filtro, las siete células harían el gesto de recogida a la vez. Se
  anima solo con `phase === "playing"`.
- La retirada va por temporizador, no en `useFrame`: tocar el estado de React en cada
  fotograma remontaría el árbol 60 veces por segundo. El filtro devuelve la misma
  referencia si no sobra ninguna, o el efecto se relanzaría en bucle.

---

## 7. Añadidos sobre la marcha

Puntos que fueron llegando después de la reunión. Mismo trato: un commit por punto.

| #   | Punto                                     | Tipo | Dónde vive                        | Estado |
| --- | ----------------------------------------- | ---- | --------------------------------- | :----: |
| 7   | No se puede disparar mientras se apunta   | Bug  | `game/scenes/GameScene.tsx`       |   🟨   |
| 8   | Zumbido de la nave: se reinicia y molesta | Bug  | `shared/sfx.ts` + `GameScene.tsx` |   🟨   |
| 9   | Música de fin de partida demasiado alta   | Bug  | `shared/sfx.ts`                   |   🟨   |
| 10  | Suelo visible que no se puede pisar       | Bug  | `game/maps/neonBlockLayout.ts`    |   🟨   |
| 11  | La nave salta al apuntar el cazador       | Bug  | `game/scenes/GameScene.tsx`       |   🟨   |

### 7. No se puede disparar con el izquierdo mientras se apunta con el derecho

**Causa.** No es cosa del doble clic: los eventos de puntero **solo emiten `pointerdown` al
pasar de cero botones a uno**. Con el derecho ya apretado, pulsar el izquierdo llega como
`pointermove` con `button = 0` (los movimientos normales traen `-1`), y el disparo escuchaba
solo `pointerdown`. Por eso con F sí se disparaba: ahí no hay ningún botón pulsado.

**Arreglo.** Escuchar también `pointermove` y distinguir pulsar de soltar mirando si el bit
del botón sigue en `buttons`. Se aplica igual a apuntar: soltar el derecho con el izquierdo
aún pulsado tampoco daba `pointerup`, así que la mira se quedaba encendida.

### 8 y 9. Sonido

**El zumbido se reiniciaba** porque al volver a virar dentro del fundido de salida se
cortaba la fuente y se lanzaba otra desde el principio del mp3. Ahora el corte va en un
temporizador en vez de programado en el nodo (`stop()` no se puede deshacer), así que al
volver se le da la vuelta al fundido y el motor **sigue sonando donde iba**.

Además el fundido de salida pasa a 0,7 s frente a 0,25 s de entrada. Simulado: virando a
izquierda y derecha muy rápido el volumen ahora solo baja al 85 % en vez de reiniciarse; a
ritmo normal, al 70 %. Los virajes sueltos siguen apagándose del todo.

**Volúmenes:** nave 0,45 → 0,3, y la atenuación por distancia pasa a ser cuadrática (antes
la nave sonaba a media potencia a mitad de mapa). Música de cierre 0,7 → 0,4.

### 11. La nave da un salto cuando el cazador apunta

**Causa.** La nave no vuela sola: cuelga de la cámara del cazador, y **esa posición es la
que se publica a los demás**. Al apuntar se colocaba con un `if (aiming)` — un booleano, no
el avance del zoom:

- sin apuntar, 1,25 **por delante** de la cámara;
- apuntando, 1,15 **por detrás**.

Como el booleano cambia de golpe, la nave **saltaba 2,37 unidades en un solo fotograma**
(unas 142 u/s) nada más pulsar el botón, y otro tanto al soltarlo. El zoom de la cámara dura
0,16 s, pero la nave no lo acompañaba: se teletransportaba. Eso es lo que veían los
escondidos. De propina disparaba el zumbido del motor, porque el umbral para considerar la
nave en movimiento es 0,15 u/s.

**Arreglo.** El rig de cámara publica el avance del zoom ya suavizado
(`seekerAimBlend`, mismo patrón que `seekerTurn`) y la nave **encoge su separación de la
cámara al mismo ritmo al que esta se acerca**. La cuenta sale exacta: la cámara va de 4,75 a
3,50 del centro y la separación de 1,25 a 0, así que la nave se queda en 3,50 todo el rato.
Es literalmente lo que ya decía el comentario del zoom — «el acercamiento acaba justo donde
ella estaba» —, solo que ahora la nave no se aparta para dejarle el sitio.

|                           |  Antes   | Ahora |
| ------------------------- | :------: | :---: |
| Salto en un fotograma     | **2,37** | 0,009 |
| Recorrido durante el zoom |   1,36   | 0,36  |

Con la mira puesta la cámara queda **dentro** de la nave, así que se deja de dibujar para el
propio cazador (media eslora de umbral). El haz del láser sigue saliendo por detrás y debajo
de la cámara: es un apaño de primera persona para verlo converger en la retícula, y no
depende de dónde esté la nave.

De paso, `ChaserShip` deja de suscribirse a `aiming`: la mira le entra por un valor de
módulo, así que ya no se re-renderiza cada vez que se apunta.

### 10. Suelo visible que no se puede pisar

**Causa, medida.** El suelo que se ve es la losa `street-simple.glb`, y **es cuadrada**: con
la escala uniforme de 2,6267 cubre 5×5. Pero la manzana es de **5×4** — eso dicen los
bounds, el heightmap, el suelo pintado de reserva, `ROADS.halfZ` y la posición de todos los
edificios. Sobraba media unidad de losa por el norte y otra por el sur.

Sumado al margen de medio cuerpo con el que el servidor recorta el área jugable, quedaban
**0,64 unidades de suelo a la vista que no se pueden pisar** por el norte y el sur, frente a
0,14 por el este y el oeste. Esa asimetría de 4× es justo lo que se nota al caminar.

**Arreglo.** `scaleZ` propio para la losa, para que su canto coincida con el del mapa. Ahora
el margen no pisable es 0,14 por los cuatro lados.

**Comprobado y descartado por el camino** (para que no se vuelva a mirar):

- El JSON del mapa del cliente y el del servidor son **idénticos**.
- Los 14 colliders visuales y los 14 obstáculos del servidor **coinciden uno a uno**: no hay
  ni paredes invisibles ni paredes atravesables.
- El heightmap está **plano y sin huecos** (357 celdas, todas a 0), así que ni la pendiente
  ni el "sin suelo" bloquean nada.
- La superficie de la losa está **a ras de y = 0**, donde camina el jugador. No hay escalón.
- El margen de 0,14 **no** es excesivo: medida la huella real de los cuatro personajes en sus
  GLB, el más ancho da un radio de 0,147. Ahí no había nada que arreglar.

---

## 4. La cámara se mete dentro de los edificios

**Situación.** La cámara del escondido (`GameScene.tsx:751-758`) se coloca a
`HIDER_CAMERA_DISTANCE = 1.8` detrás de un personaje de `0.36` de alto, en un mapa de 5×4
con edificios de `1.4`. Va a destino con un `lerp` y **no consulta el mapa**: atraviesa
fachadas constantemente.

**Qué se hace.** No hace falta física nueva — la pieza ya existe:

- `rayBoxDistance` (`GameScene.tsx:1150-1172`) y los AABB de `obstacles` del mapa son
  exactamente lo que usa el láser para saber contra qué choca.
- Se traza desde la cabeza del jugador hacia la posición deseada de cámara y se recorta la
  distancia al primer impacto menos un margen (para que el plano cercano no entre en el
  muro). Igual con el suelo, que también se atraviesa mirando desde abajo.
- La distancia recortada se suaviza: acercar rápido (no quieres ver el interior ni un
  fotograma) y alejar lento, o la cámara da tirones al pasar junto a una esquina.
- Se revisa también la órbita del cazador (`placeOrbit`, `GameScene.tsx:1331-1339`), aunque
  ahí el radio deja la cámara fuera del mapa y molesta menos.

**Riesgo.** Medio. Toca la cámara de juego: cualquier fallo se nota en cada partida. Se
prueba escondido pegado a fachadas, en callejones y en esquinas.

**Hecho** (falta jugarlo). `cameraClearance` traza desde la cabeza hacia donde iría la
cámara contra los mismos AABB que usan el láser y el servidor, y recorta la distancia.
Entrar es inmediato y salir se recupera despacio (exponencial, independiente de la tasa
de fotogramas), o cada esquina daría un tirón; y mientras la empujan hacia dentro el
viaje de la cámara sube de 0.08 a 0.45, porque a ritmo normal para cuando llegase ya se
habría visto el interior.

**Un suelo fijo de distancia no vale, y por poco se cuela.** Con `MIN_CAMERA_DISTANCE =
0.45` y la pared a 0.10 de la cabeza, el mínimo gana y devuelve la cámara al interior del
edificio — exactamente el fallo que se venía a arreglar. El retranqueo pasa a ser fijo
(0.15) _o_ proporcional (80 % del hueco), lo que deje la cámara más cerca del muro sin
cruzarlo.

Verificado con un barrido exhaustivo del mapa real (483 912 combinaciones de posición
válida × 24 orientaciones × 3 inclinaciones):

- La cámara se recortaba contra un muro en el **30,2 %** de los casos. Eso es lo que se
  venía atravesando.
- Quedan 5 231 casos (1,1 %) con la cámara técnicamente dentro, todos con la cabeza a
  menos de 1,6 cm de la fachada, y con una penetración máxima de 0,02 unidades. El plano
  cercano de la cámara está a 0,1 — cinco veces más —, así que ese trozo de muro queda
  recortado y no llega a verse.

De propina: por debajo de 0.5 de distancia se oculta el personaje propio, que si no se ve
por dentro de la cabeza. La órbita del cazador se deja como está: su radio (3,5 mínimo)
la mantiene siempre fuera de la huella del mapa, no llega a entrar en ningún edificio.

---

## 5. Transición andar ↔ idle

**Situación — la causa está clara.** Los personajes no usan un `AnimationMixer` en vivo:
las poses están **horneadas** (`GameScene.tsx:590-680`) en 12 fotogramas de idle y 8 de
andar, y se dibujan con `InstancedMesh` por fotograma. El shader
(`patchMorphMaterial`, línea 136) interpola _dentro_ de un ciclo — cada geometría lleva la
pose siguiente del **mismo** clip.

Entre los dos clips no hay nada: `motion.moving` es un booleano
(`advanceMotion`, línea 118) y al cambiar, el personaje **salta** de una zancada a media
altura a una pose de reposo, en un fotograma. Eso es lo que se ve raro al pararse.

**Qué se hace.**

- **Histéresis en `moving`**: umbrales distintos para arrancar y para parar. Hoy con un
  único `MOVEMENT_EPSILON_SQ = 1e-8` una entidad muy lenta puede alternar cada fotograma.
- **Peso de mezcla continuo** por entidad (0 = quieto, 1 = andando) que sube y baja en
  ~0,18 s en vez de conmutar.
- **Mezcla real entre clips en el shader**: cada geometría lleva ya `nextPosition`; se le
  añade un segundo par de atributos con la pose del _otro_ clip y un peso por instancia.
  Así la entidad se dibuja en la malla del clip destino y sus vértices se mezclan desde el
  de origen. Es la parte más delicada: hay que mantener el reparto por `InstancedMesh` y
  no romper el conteo de instancias.
- **Revisar el idle en sí**: 12 fotogramas a 6 fps con interpolación deberían bastar; si
  aun así se lee pobre, se sube el número de poses horneadas o se ajusta la cadencia.

**Riesgo.** El más alto de los seis. Es el sistema de render de personajes entero (hasta
71 entidades). Se mide el coste antes y después: si el atributo extra pesa demasiado, hay
plan B — mezclar solo hacia una pose de reposo canónica en vez de al fotograma exacto.

**Hecho** (falta jugarlo). Se ha ido directamente al plan B, porque resulta ser mejor que
el plan A y no un apaño:

`motion.moving` deja de mandar sobre la pose y pasa a alimentar un peso continuo
(`walkWeight`, 0..1) que recorre el trayecto en 0,18 s — 11 fotogramas a 60 Hz. El shader
encadena una segunda mezcla, hacia una **pose neutra** (el primer fotograma del idle):

```glsl
transformed = mix(mix(position, nextPosition, MORPH), restPosition, BLEND);
```

Por encima de 0,5 la entidad se dibuja en el ciclo de andar y por debajo en el de quieto,
y en ambos casos el resto del camino lo cubre `BLEND` hacia esa pose. **La clave es que la
pose neutra sea la misma en los dos conjuntos**: con `BLEND = 1` el vértice vale
`restPosition` y nada más, así que las dos ramas coinciden exactamente en 0,5 y el cambio
de malla no se ve. Comprobado numéricamente: el salto en el cruce es 2e-4 (cero en el
límite).

Por qué esto es mejor que mezclar al fotograma exacto del otro ciclo: haría falta un par
de atributos por conjunto y, sobre todo, **las dos ramas no casarían en el cruce** — una
llegaría a la pose de reposo y la otra a la de zancada, y el salto seguiría ahí, solo que
más pequeño. Con destino común el problema desaparece por construcción.

Coste: **cero memoria nueva en la GPU**. `restPosition`/`restNormal` referencian los
BufferAttribute que ya existen del primer fotograma del idle, compartidos por los 20
fotogramas de los dos conjuntos, igual que ya se compartía `nextPosition`. Se añade un
`aBlend` por instancia (un float) y dos `mix` por vértice.

De regalo, la histéresis sobre `moving` que pedía el plan sobra: un parpadeo de un
fotograma mueve el peso un 9 % y, si acaba rondando el 0,5, ahí las dos ramas dan la misma
pose — el parpadeo es invisible por construcción.

Queda por comprobar en pantalla si además **el propio clip de idle** se lee pobre, que es
la otra mitad de "se queda raro en quieto". Eso no se puede juzgar sin verlo.

---

## 6. El sol no se renderiza bien en Home

**Situación.** Con la cámara en `home` (`cameraPoses.ts:15`, en `z 56`) y el sol a
`z -1000` con un disco de radio 138, el sol ocupa unos 15° de los 58° de campo vertical y
queda alto, arrinconado contra el borde superior. De ahí la sensación de "estamos
demasiado lejos".

**Qué se hace.**

1. **Comprobarlo primero en pantalla** — arrancar el frontend y mirar la home antes de
   tocar nada. No merece la pena ajustar a ciegas: puede que lo que falle sea el encuadre,
   el cielo pintado que hay detrás (`assets/sky-home-3d.png`, capa HTML tras el canvas), o
   el propio tamaño.
2. Según lo que se vea, la palanca es el tamaño y la altura del disco y sus dos halos
   (`HomeSun.tsx:73-114`), manteniendo la restricción que ya documenta el archivo: el sol
   vive detrás de las montañas (plano de 240 de fondo centrado en `z -850`) para que las
   crestas le corten la base.
3. Verificación visual final en home y en el viaje a la ciudad, que comparten cámara.

**Riesgo.** Bajo en código, pero es puro criterio visual: se valida con capturas.

**Hecho, y NO era criterio visual: era un recorte.** Menos mal que no se ajustó a ojo — el
tamaño del sol no tenía nada que ver.

**Causa.** `react-three-fiber` crea su cámara con `new PerspectiveCamera(75, 0, 0.1, 1000)`,
y el `<Canvas>` de la home solo le pasa posición, rotación y `fov`: **el plano lejano se
quedaba en 1000**. El sol vive en `z = -1000` y la cámara de la home en `z = 56`, con lo que
el disco queda a una profundidad de entre 989 y 1049 — el plano lejano lo **parte por la
mitad**.

Medido con la pose real de la cámara (`home`, mirando 12,6° hacia abajo):

| Pieza                 | Se dibujaba | Con `far = 2000` |
| --------------------- | :---------: | :--------------: |
| Disco solar (r 138)   |  **18 %**   |      100 %       |
| Halo interior (r 165) |    22 %     |      100 %       |
| Halo exterior (r 215) |    28 %     |      100 %       |

O sea: solo se veía la coronilla del sol. Y a las montañas del fondo les recortaba todo lo
que quedara por debajo de `y = -12`, con el plano del relieve a `y = -50` — la base del
horizonte también estaba cortada.

"Como si estuviésemos demasiado lejos" era literal: lo estábamos, para el plano lejano de la
cámara.

**Arreglo.** Declarar `far: 2000` en `initialCameraProps()` — el valor por defecto de
three.js. Lo más lejano de la escena (canto inferior del halo, cordilleras laterales desde la
pose del coche) ronda 1080, así que sobra margen.

**Deliberadamente NO se ha tocado el tamaño ni la altura del sol.** Con el 82 % restante ya
en pantalla, lo más probable es que quede como se diseñó; retocar las medidas encima sería
compensar a ciegas un fallo que ya está corregido. Si al verlo sigue pareciendo pequeño, se
ajusta entonces, y sobre lo que se ve de verdad.

**La escena de la partida no necesita nada:** monta el mismo `HomeSun` pero a escala 0,05,
con todo a menos de 60 unidades de la cámara. Comprobado.

---

## Orden propuesto

De menor a mayor riesgo, para que la rama tenga valor desde el primer commit:

```text
1 (copiar código)  →  2 (chat)  →  3 (coleccionable)  →  6 (sol)  →  4 (cámara)  →  5 (idle/andar)
```

Los puntos 4 y 5 tocan el mismo archivo (`GameScene.tsx`) pero zonas distintas: cámara y
personajes. No se pisan.
