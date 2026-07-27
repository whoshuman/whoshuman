# Game Service — Partida y loop autoritativo

Documento que explica **cómo funciona** el `game-service`: la partida en tiempo
real. Recibe el `match.found` del matchmaking, crea la partida, corre el **loop
autoritativo (~20 fps)** que simula el movimiento de los jugadores y emite el
estado para que el frontend lo pinte.

> La sala de espera previa la explica [`Matchmaking.md`](Matchmaking.md).

---

## 1. Idea general

El `game-service` es el **cerebro de la partida**. Sigue el modelo **servidor
autoritativo** (Arquitectura §7): el cliente **envía intención y renderiza**; el
servidor **valida, simula y decide**. La verdad del juego vive **solo** en el
servidor.

- El estado de la partida está **en memoria** y es **efímero**: si el servicio se
  reinicia, se pierde (todavía no hay persistencia en BD).
- El loop corre a **20 fps** (un "tick" cada 50 ms): en cada tick mueve a los
  jugadores según su última intención y emite el estado a todos.

Este documento cubre el **movimiento de jugadores**. Lo que aún **no** entra
(NPCs, disparo, diamantes, rondas) está en la §8.

---

## 2. Cómo viaja el movimiento

El cliente nunca habla con el `game-service` directamente: pasa por el
`realtime-gateway`, que traduce socket ↔ NATS.

```
cliente (Socket.IO)
   │  emit "game:player-input" { gameId, forward, turn }
   ▼
realtime-gateway
   │  valida que el socket está en esa partida
   │  publish game.player.moved { userId, gameId, forward, turn }   (añade el userId del JWT)
   ▼  NATS
game-service
   │  guarda la "última intención" del jugador
   │  cada 50 ms (tick): mueve a todos y emite el estado
   │  publish game.state.snapshot { gameId, tick, entities:[…] }
   ▼  NATS
realtime-gateway
   │  emit "game:state" a la room game:<gameId>
   ▼
todos los clientes de la partida → pintan
```

### Subjects NATS y eventos de socket

| Capa   | Nombre                    | Dirección                  | Para qué                                |
| ------ | ------------------------- | -------------------------- | --------------------------------------- |
| socket | `game:join`               | cliente → gateway          | entrar a la partida                     |
| socket | `game:joined`             | gateway → cliente          | **confirmación** de que ya estás dentro |
| socket | `game:player-input`       | cliente → gateway          | mandar la intención (avanzar / girar)   |
| socket | `game:aim`                | cliente → gateway          | activar o soltar la mira                |
| socket | `game:shoot`              | cliente → gateway          | disparar a una entidad opaca            |
| socket | `game:state`              | gateway → sala             | estado del juego (cada tick)            |
| socket | `game:leave`              | cliente → gateway          | salir de la partida                     |
| NATS   | `matchmaking.match.found` | matchmaking → game-service | crea la partida                         |
| NATS   | `game.join`               | gateway ↔ game-service     | entra y devuelve `selfEntityId` privado |
| NATS   | `game.disconnected`       | gateway → game-service     | inicia una gracia de reconexión         |
| NATS   | `game.leave`              | gateway → game-service     | sale un jugador                         |
| NATS   | `game.player.moved`       | gateway → game-service     | la intención de movimiento              |
| NATS   | `game.aim`                | gateway → game-service     | estado autoritativo de la mira          |
| NATS   | `game.shoot`              | gateway → game-service     | valida y aplica el disparo              |
| NATS   | `game.state.snapshot`     | game-service → gateway     | el estado a difundir                    |

---

## 3. El loop autoritativo

Control tipo **tank** (como en Just Act Natural): el jugador tiene una orientación
(`heading`) que gira con `turn`, y avanza hacia donde mira con `forward`. En cada
tick (50 ms), por cada jugador presente:

```
heading  = heading + turn · GAME_TURN_SPEED · dt              (girar; A/D)
paso     = forward · GAME_SPEED · dt                          (avanzar; W/S)
nueva_x  = x + sin(heading) · paso
nueva_z  = z + cos(heading) · paso
```

El movimiento se prueba **por eje** (X y Z por separado) y solo se aplica si el
destino es transitable (ver §5). Así el jugador **desliza** a lo largo de las
paredes en vez de quedarse clavado.

- La **velocidad y la de giro las fija el servidor** (`GAME_SPEED`,
  `GAME_TURN_SPEED`), no el cliente. Por eso un cliente no puede "teletransportarse":
  solo manda intención (`forward`, `turn` en `[-1, 1]`).
- Se puede **girar en el sitio** (`turn ≠ 0`, `forward = 0`) sin desplazarse.
- La **rotación (`heading`) es estado del servidor**; el cliente no la manda, la
  recibe en el snapshot como `rotationY`.
- El estado resultante se emite como `game:state` a toda la partida.

---

## 4. Estado y ciclo de vida de la partida

La partida se crea y se destruye sola, sin tocar BD:

```
matchmaking.match.found { gameId, players:[{userId, role}] }
   → game-service crea la partida (en memoria) y arranca su loop

cliente entra a /game → game:join → el jugador queda "presente" en su spawn
cliente mueve → game:player-input → se guarda su intención
loop 20 fps → emite game:state con las posiciones

game:leave o desconexión → el jugador se quita de la partida
cuando no queda ningún jugador → la partida se destruye y el loop se detiene
```

- Los **spawns** (posiciones de salida) se reparten en círculo al crear la partida.
- El snapshot incluye desde el inicio todas las entidades de la partida para que
  la llegada o salida de un jugador no revele cuál es humano. Durante la gracia
  de reconexión su entidad permanece quieta en la última posición.

---

## 5. Colisiones — estado actual (importante)

Toda la física va en el servidor (`GameSession.tick`), a partir del **descriptor
del mapa** (ver §8). El jugador es un **punto** que el servidor mueve o frena.

| Tipo de colisión                | ¿Existe hoy? | Detalle                                                                                                             |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| Contra el **borde del mapa**    | ✅ Sí        | El jugador no sale del área jugable (`bounds` del descriptor, clamp por eje).                                       |
| Contra **edificios**            | ✅ Sí        | `obstacles` (rectángulos AABB): no se atraviesan ni se suben. Se **desliza** a lo largo de la pared.                |
| **Altura** (rampas / escalones) | ✅ Sí        | `heightmap` + `GAME_MAX_STEP`: sube rampas suaves; frena en muros, bordillos, tejados y árboles. Sin caer al vacío. |
| Entre **jugadores**             | ❌ No        | Los jugadores **se atraviesan**: pueden ocupar el mismo punto sin efecto (no se empujan ni se bloquean).            |

**Cómo funciona la altura:** el servidor lleva la altura del suelo bajo cada
jugador. Al intentar moverse, muestrea la altura del destino: si no hay suelo, o si
el desnivel supera `GAME_MAX_STEP`, **bloquea** ese eje; si el desnivel es pequeño
(rampa), avanza y actualiza la altura. Así solo se sube por las rampas, no por sus
caras verticales.

**Por qué no hay colisión entre jugadores (por ahora):** es una decisión de diseño
aún abierta. En juegos de "mézclate en la multitud" como Just Act Natural lo
habitual es que los peatones **no** colisionen de forma dura entre sí (genera
atascos y delataría a los humanos). La regla de oro para el futuro: **jugadores y
NPCs deben comportarse igual** — si no, un seeker notaría quién frena y quién
atraviesa, y sabría quién es humano.

> El servidor trabaja con **posiciones continuas** (decimales `x`, `z`), no con
> casillas. No existe el concepto de "dos jugadores en la misma casilla": pueden
> estar arbitrariamente cerca sin que pase nada.

Cuando llegue el mapa real con obstáculos, la validación de "¿puedo estar aquí?"
se añadirá en el mismo punto del loop (sin tocar el contrato con el frontend).

---

## 6. Roles (hider / seeker) — estado actual

- El rol (1 `seeker` + el resto `hiders`) lo asigna el **matchmaking** y viaja en
  el `match.found`.
- El `seeker` no camina ni aparece como peatón. Su cliente usa una cámara orbital
  exterior y puede pulsar una entidad para disparar.
- El servidor acepta el disparo solo si quien lo envía es el `seeker` presente,
  mantiene la mira activa y el `targetEntityId` pertenece a una entidad viva; al
  acertar, la elimina.
- El `game:state` **no incluye el rol** a propósito: los hiders no deben distinguir
  quién es el seeker ni quién es humano. **Cada cliente conoce solo su propio rol**,
  recibido privadamente en `game:joined`.

---

## 7. PARA EL FRONTEND (resumen para el equipo de cliente)

Todo lo que necesita el cliente, junto. El frontend **no calcula posiciones**:
las recibe ya hechas y solo las pinta.

### 7.1 Obtener el `gameId` y tu rol

Vienen del evento de la sala (`Matchmaking.md`):

```ts
// socket: "matchmaking:match-found"
{
  gameId: "….",
  players: [ { userId, role }, … ]   // busca tu userId aquí para saber tu rol
}
```

Con `gameId` navegas a `/game`; con tu `role` decides tu cámara/HUD.

### 7.2 Entrar a la partida — el orden IMPORTA

```
1. emit  "game:join"  { gameId }
2. espera "game:joined" { gameId, selfEntityId, role }  ← identidad y rol privados
3. SOLO ENTONCES empieza a mandar "game:player-input"
```

⚠️ Si mandas `game:player-input` **antes** de recibir `game:joined`, el servidor
lo rechaza con `gateway:error` → `"Socket is not joined to this game"`. Espera
siempre la confirmación.

### 7.3 Mandar movimiento — intención tank (avanzar / girar)

El cliente lee el teclado/joystick y manda **dos ejes de intención**, nunca la
posición ni la rotación:

```ts
// socket: "game:player-input"
{
  gameId,
  forward: number,  // -1..1  → W = +1 (adelante), S = -1 (atrás)
  turn: number      // -1..1  → A = +1 (girar izquierda), D = -1 (girar derecha)
}
```

Traducción típica de teclas:

| Tecla(s)     | `forward` | `turn` | Efecto                        |
| ------------ | --------- | ------ | ----------------------------- |
| W            | `1`       | `0`    | avanza hacia donde mira       |
| S            | `-1`      | `0`    | retrocede                     |
| **A**        | `0`       | `1`    | **gira a la izquierda**       |
| **D**        | `0`       | `-1`   | **gira a la derecha**         |
| W + A        | `1`       | `1`    | avanza girando a la izquierda |
| nada pulsado | `0`       | `0`    | quieto                        |

- **A y D son giros** (cambian la orientación), no desplazamientos laterales. El
  jugador avanza/retrocede con W/S hacia donde mira.
- Manda el input **cuando cambie** (o cápalo a ~20–30 Hz). No hace falta enviarlo
  cada frame.
- No mandes posición, ni velocidad, ni rotación: de eso se encarga el servidor.

### 7.4 Recibir y pintar el estado

```ts
// socket: "game:state"  (llega ~20 veces/seg)
{
  gameId: string,
  tick: number,
  entities: [ { entityId, x, y, z, rotationY }, … ] // humanos y NPC son indistinguibles
}
```

El snapshot nunca contiene `userId`, rol, tipo de entidad ni modo del NPC. Solo
`selfEntityId`, recibido privadamente en `game:joined`, permite reconocer la
entidad controlada por ese cliente.

El `seeker` dispara con `game:shoot { gameId, targetEntityId }`. El cliente solo
elige una entidad visible; el servidor valida el rol y decide si la elimina.

Por cada entidad, coloca su modelo 3D en `(x, y, z)` mirando hacia `rotationY`.
La **`y` la decide el servidor** (altura del suelo bajo el jugador, según el mapa):
el cliente **no** debe recalcularla con su propio raycast, o pintaría al personaje
subido a árboles o tejados que el servidor no permite pisar.
**El estado es completo en cada snapshot** (no son diferencias): pinta siempre el
último que recibas.

### 7.5 Suavizado (responsabilidad del cliente)

Pintar los snapshots "a pelo" se ve a tirones y con algo de retardo. El cliente
debe suavizar (es trabajo de frontend, no cambia el servidor):

- **Interpolación**: anima entre el snapshot anterior y el nuevo para un
  movimiento fluido (recomendado para los **otros** jugadores).
- **Predicción + reconciliación** (opcional, avanzado): para **tu propio**
  jugador, mueve localmente al instante y corrige con el estado del servidor
  cuando llega. Reduce el lag percibido sin romper la autoridad del servidor.

### 7.6 Por qué no hay que preocuparse por mensajes perdidos

El diseño es robusto a pérdidas porque se manda **estado absoluto**, no comandos:

- Si se pierde un `game:player-input`, el siguiente (mandas la intención de forma
  continua) corrige al instante. No se acumula error.
- Si se pierde un `game:state`, el siguiente trae todas las posiciones completas.
  Solo pinta el último.

No necesitas ack ni reintentos de inputs. (WebSocket va sobre TCP, así que en la
práctica no se pierden en silencio; el reto real es el lag, que se cubre con el
suavizado de §7.5.)

### 7.7 Refresh y reconexión MVP

El cliente guarda el `gameId` activo en `sessionStorage`. Al refrescar la ruta
`/game` o recuperar la conexión, espera `gateway:ready` y vuelve a emitir
`game:join`. El game-service mantiene durante **45 segundos** la misma entidad,
rol y posición, deteniendo antes su input para que no siga caminando solo.

`game:leave` sigue siendo una salida inmediata y solo se envía al pulsar
**Abandonar**. Una caída del socket publica `game.disconnected`; además, el
`socketId` activo evita que una desconexión tardía del socket anterior invalide
una reconexión ya completada.

Esta recuperación es deliberadamente local al MVP: sobrevive a refresh y cortes
breves, pero no a reiniciar el contenedor de game-service. Redis o persistencia
distribuida se añadirá cuando haya varias instancias o se necesite tolerar esos
reinicios.

---

## 8. Parámetros (config / envs)

En `apps/game-service/.env` (validados con joi):

| Variable          | Default     | Qué controla                                      |
| ----------------- | ----------- | ------------------------------------------------- |
| `GAME_TICK_MS`    | `50`        | periodo del loop (50 ms = 20 fps)                 |
| `GAME_SPEED`      | `3`         | velocidad de avance del jugador (unidades/seg)    |
| `GAME_TURN_SPEED` | `3.0`       | velocidad de giro (radianes/seg)                  |
| `GAME_MAX_STEP`   | `0.11`      | desnivel máx por tick (rampa sí, escalón/muro no) |
| `GAME_MAP`        | `beta-city` | qué mapa cargar → `maps/<GAME_MAP>.json`          |
| `GAME_NPC_COUNT`  | `32`        | peatones autoritativos de la partida              |
| `GAME_NPC_SPEED`  | `1.2`       | velocidad de paseo de los NPC                     |

La **geometría del mapa ya no está en envs**: vive en un **descriptor JSON** por
mapa (`apps/game-service/src/game/maps/<GAME_MAP>.json`), con:

- `bounds`: área jugable `{minX, minZ, maxX, maxZ}` (el jugador no sale de aquí).
- `obstacles`: rectángulos AABB de los edificios.
- `heightmap`: rejilla de alturas del suelo (para rampas/escalones).

`GAME_MAX_STEP` se afina por mapa según sus pendientes (rampa vs bordillo).

### Coordenadas (acuerdo con el frontend)

El descriptor está en el **mismo marco** que usa el frontend: el front carga el
`.glb` y lo **centra** aplicando el offset de su centro (para `beta-city.glb`:
`(-8.5, -0.3)`), y el script de extracción aplica ese mismo offset. Así lo que el
servidor calcula cae sobre el mapa visible. El **movimiento va 100% en el
servidor**; centrar el mapa es solo **render** — el front desplaza el mapa, nunca
las posiciones de los jugadores.

### Cambiar de mapa

Se genera el descriptor JSON del nuevo `.glb` con el script de extracción, se
apunta `GAME_MAP` a él y se afina `GAME_MAX_STEP`. **El código del servidor no se
toca.**

---

## 9. Fuera de alcance (futuro)

- **Modelos y animaciones de NPCs** (el movimiento errático server-side ya funciona).
- **Colisión entre jugadores** (hoy se atraviesan; la colisión contra el
  escenario y la altura ya están, ver §5).
- **Reglas avanzadas del seeker**: munición, enfriamiento y validación geométrica
  de línea de visión.
- **Detección** (suspicion meter), **diamantes**, **items** (smoke/warp).
- **Rondas**: tiempo límite, rotación de roles, resultados, victoria.
- **Persistencia** de la partida (`Game`/`Score` en BD).
- **Suavizado de cliente** (interpolación/predicción) — trabajo de frontend.
- **Reconexión** a una partida en curso.
