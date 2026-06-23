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
   │  emit "game:player-input" { gameId, move:{x,z} }
   ▼
realtime-gateway
   │  valida que el socket está en esa partida
   │  publish game.player.moved { userId, gameId, move }   (añade el userId del JWT)
   ▼  NATS
game-service
   │  guarda la "última intención" del jugador
   │  cada 50 ms (tick): mueve a todos y emite el estado
   │  publish game.state.snapshot { gameId, tick, players:[…] }
   ▼  NATS
realtime-gateway
   │  emit "game:state" a la room game:<gameId>
   ▼
todos los clientes de la partida → pintan
```

### Subjects NATS y eventos de socket

| Capa   | Nombre                     | Dirección                  | Para qué                                |
| ------ | -------------------------- | -------------------------- | --------------------------------------- |
| socket | `game:join`                | cliente → gateway          | entrar a la partida                     |
| socket | `game:joined`              | gateway → cliente          | **confirmación** de que ya estás dentro |
| socket | `game:player-input`        | cliente → gateway          | mandar la dirección de movimiento       |
| socket | `game:state`               | gateway → sala             | estado del juego (cada tick)            |
| socket | `game:leave`               | cliente → gateway          | salir de la partida                     |
| NATS   | `matchmaking.match.found`  | matchmaking → game-service | crea la partida                         |
| NATS   | `game.join` / `game.leave` | gateway → game-service     | entra / sale un jugador                 |
| NATS   | `game.player.moved`        | gateway → game-service     | la intención de movimiento              |
| NATS   | `game.state.snapshot`      | game-service → gateway     | el estado a difundir                    |

---

## 3. El loop autoritativo

En cada tick (50 ms), por cada jugador presente:

```
nueva_posición = posición + dirección · velocidad · dt        (dt = 0.05 s)
posición = recortar(nueva_posición, límites del mapa)         (clamp al borde)
rotación = atan2(dirección.x, dirección.z)                    (mira hacia donde anda)
```

- La **velocidad la fija el servidor** (`GAME_SPEED`), no el cliente. Por eso un
  cliente no puede "teletransportarse": solo manda dirección.
- La **dirección se normaliza** (`|move| ≤ 1`): mandar un vector enorme no te hace
  ir más rápido.
- La **rotación la calcula el servidor** a partir del movimiento; el cliente no la
  manda.
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
- Un jugador solo aparece en el `game:state` cuando ha hecho `game:join` (está
  realmente dentro). Si se desconecta, **desaparece del estado** — es lo correcto:
  un jugador caído no debe quedar como un fantasma en el mapa.

---

## 5. Colisiones — estado actual (importante)

Hoy el servidor solo conoce **un límite**: el **borde del mapa**.

| Tipo de colisión                           | ¿Existe hoy?  | Detalle                                                                                                         |
| ------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------- |
| Contra el **borde del mapa**               | ✅ Sí         | El jugador no puede salir del área jugable (clamp).                                                             |
| Entre **jugadores**                        | ❌ No         | Los jugadores **se atraviesan**: pueden ocupar el mismo punto sin ningún efecto (no se empujan ni se bloquean). |
| Contra el **escenario** (paredes, bancos…) | ❌ Todavía no | No hay obstáculos aún; el mapa es un suelo plano.                                                               |

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
- El `game-service` **aún no trata distinto al seeker**: en este loop todos los
  jugadores se mueven igual. La mecánica del seeker (cámara aérea, apuntar,
  disparar — Fase 3/4) llegará después.
- El `game:state` **no incluye el rol** a propósito: los hiders no deben distinguir
  quién es el seeker ni quién es humano. **Cada cliente conoce solo su propio rol**,
  que recibió en el `match.found`.

> Nota de futuro: en Just Act Natural el seeker no camina como peatón; tiene vista
> aérea. Cuando se implemente su mecánica, dejará de emitir su posición de peatón
> pero seguirá recibiendo la del resto.

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
2. espera "game:joined" { gameId }       ← confirmación del servidor
3. SOLO ENTONCES empieza a mandar "game:player-input"
```

⚠️ Si mandas `game:player-input` **antes** de recibir `game:joined`, el servidor
lo rechaza con `gateway:error` → `"Socket is not joined to this game"`. Espera
siempre la confirmación.

### 7.3 Mandar movimiento — solo la dirección

El cliente lee el teclado/joystick y manda un **vector de dirección** en el plano,
nunca la posición:

```ts
// socket: "game:player-input"
{ gameId, move: { x: number, z: number } }   // |move| ≤ 1 ; {0,0} = quieto
```

Traducción típica de teclas a `move`:

| Tecla(s)         | `move`                                |
| ---------------- | ------------------------------------- |
| D (derecha)      | `{ x: 1,  z: 0 }`                     |
| A (izquierda)    | `{ x: -1, z: 0 }`                     |
| W (adelante)     | `{ x: 0,  z: -1 }`                    |
| S (atrás)        | `{ x: 0,  z: 1 }`                     |
| W + D (diagonal) | `{ x: 0.71, z: -0.71 }` (normalizado) |
| nada pulsado     | `{ x: 0, z: 0 }`                      |

- Manda el input **cuando cambie** (o cápalo a ~20–30 Hz). No hace falta enviarlo
  cada frame.
- No mandes posición, ni velocidad, ni rotación: de eso se encarga el servidor.

### 7.4 Recibir y pintar el estado

```ts
// socket: "game:state"  (llega ~20 veces/seg)
{
  gameId: string,
  tick: number,
  players: [ { userId, x, y, z, rotationY }, … ]   // y = 0 (suelo plano)
}
```

Por cada jugador, coloca su modelo 3D en `(x, y, z)` mirando hacia `rotationY`.
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

- Si se pierde un `game:player-input`, el siguiente (mandas la dirección de forma
  continua) corrige al instante. No se acumula error.
- Si se pierde un `game:state`, el siguiente trae todas las posiciones completas.
  Solo pinta el último.

No necesitas ack ni reintentos de inputs. (WebSocket va sobre TCP, así que en la
práctica no se pierden en silencio; el reto real es el lag, que se cubre con el
suavizado de §7.5.)

---

## 8. Parámetros (config / envs)

En `apps/game-service/.env` (validados con joi):

| Variable        | Default | Qué controla                                          |
| --------------- | ------- | ----------------------------------------------------- |
| `GAME_TICK_MS`  | `50`    | periodo del loop (50 ms = 20 fps)                     |
| `GAME_SPEED`    | `5`     | velocidad del jugador (unidades/seg)                  |
| `GAME_MAP_SIZE` | `50`    | lado del área cuadrada, centrada en 0 (límites `±25`) |

Estos valores se afinarán cuando exista el mapa real `.glb`.

---

## 9. Fuera de alcance (futuro)

- **NPCs** (peatones erráticos server-side, el alma de "Just Act Natural").
- **Colisión** entre jugadores y contra el escenario (zonas no pisables).
- **Mecánica del seeker**: cámara aérea, apuntar, disparar.
- **Detección** (suspicion meter), **diamantes**, **items** (smoke/warp).
- **Rondas**: tiempo límite, rotación de roles, resultados, victoria.
- **Persistencia** de la partida (`Game`/`Score` en BD).
- **Suavizado de cliente** (interpolación/predicción) — trabajo de frontend.
- **Reconexión** a una partida en curso.
