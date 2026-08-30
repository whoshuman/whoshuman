# Ajustes de pulido — reunión

> Rama: `fix/ajustes-reunion` (sale de `develop` en `15ee337`)
> Seis puntos acordados en reunión. Se implementan **de uno en uno**, un commit por punto.

Leyenda: ⬜ Pendiente · 🟨 En progreso · ✅ Hecho

| #   | Punto                                 | Tipo   | Dónde vive                                          | Estado |
| --- | ------------------------------------- | ------ | --------------------------------------------------- | :----: |
| 1   | Botón de copiar código de sala        | Falta  | `pages/Lobby.tsx` (RoomPanel) + i18n                |   ✅   |
| 2   | Pulir interfaz del chat de usuarios   | Mejora | `shared/ChatWindow.tsx`                             |   ⬜   |
| 3   | Animación al recoger un coleccionable | Mejora | `game/scenes/GameScene.tsx` (`Collectibles`)        |   ⬜   |
| 4   | Cámara que se mete en los edificios   | Bug    | `game/scenes/GameScene.tsx` (cámara del escondido)  |   ⬜   |
| 5   | Transición andar ↔ idle               | Bug/UX | `game/scenes/GameScene.tsx` (`Units`, morph shader) |   ⬜   |
| 6   | El sol no se renderiza bien en Home   | Bug    | `features/home-3d/HomeSun.tsx`                      |   ⬜   |

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

---

## Orden propuesto

De menor a mayor riesgo, para que la rama tenga valor desde el primer commit:

```text
1 (copiar código)  →  2 (chat)  →  3 (coleccionable)  →  6 (sol)  →  4 (cámara)  →  5 (idle/andar)
```

Los puntos 4 y 5 tocan el mismo archivo (`GameScene.tsx`) pero zonas distintas: cámara y
personajes. No se pisan.
