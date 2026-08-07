# Matchmaking — Sala de espera (lobby)

Documento que explica **cómo funciona** el `matchmaking-service`: la sala de
espera donde los jugadores entran, **ven la sala llenarse en tiempo real**, cada
uno marca **ready**, y la partida arranca cuando **todos** están listos (con un
mínimo de 2), repartiendo los roles.

> El transporte WebSocket lo explica [`realtime-postman.md`](realtime-postman.md).

---

## 1. Idea general

El `matchmaking-service` mantiene una **sala de espera** en memoria. No es 3D ni
tiene movimiento: eres una **entrada en una lista**. El movimiento solo existe
cuando la partida arranca (eso ya es el `game-service`, fuera de aquí).

Hay **una sala pública** (`lobbyId = "main"`). Cuando hay al menos 2 jugadores y
**todos** han marcado ready, el servicio asigna roles (1 seeker + el resto hiders)
y emite `match.found`, que el `game-service` recogerá para crear la partida.

Permisos: cualquier usuario autenticado puede entrar. El "quién soy" sale del
**JWT** (lo verifica el `realtime-gateway` al conectar el socket), nunca del body.

---

## 2. Estado de la sala (en memoria)

La sala es un objeto **efímero** (no toca BD): si el servicio se reinicia, se
vacía. Cada `lobbyId` tiene su lista de jugadores, y cada jugador su estado
`ready`:

```ts
interface Lobby {
  lobbyId: string;
  players: QueuedPlayer[];
}

interface QueuedPlayer {
  userId: string;
  username: string;
  socketId: string;
  ready: boolean; // entra en false; cambia con "lobby:ready"
}
```

No hay temporizador ni estados de cuenta atrás: el arranque depende **solo** de
que haya ≥ 2 jugadores y que todos tengan `ready === true`.

---

## 3. Cómo viaja una petición

Mismo patrón que el resto del proyecto: el socket habla con el
`realtime-gateway`, que traduce a eventos NATS. El matchmaking nunca ve el socket.

```
Cliente (Socket.IO)
   │  emit "lobby:join"  (+ JWT en el handshake)
   ▼
realtime-gateway
   │  socket.join("lobby:main")
   │  publish matchmaking.joinQueue  { userId, username, lobbyId, socketId }
   ▼  NATS
matchmaking-service
   │  añade a la sala → evalúa (¿≥2 y todos ready? → arranca)
   │  publish matchmaking.lobby.updated   (estado de la sala)
   │  publish matchmaking.match.found     (solo al arrancar)
   ▼  NATS
realtime-gateway
   │  server.to("lobby:main").emit("lobby:state" | "matchmaking:match-found")
   ▼
todos los clientes de la sala
```

### Subjects NATS (`packages/shared-events`)

| Subject                     | Dirección             | Cuándo                          |
| --------------------------- | --------------------- | ------------------------------- |
| `matchmaking.joinQueue`     | gateway → matchmaking | el cliente entra a la sala      |
| `matchmaking.leaveQueue`    | gateway → matchmaking | el cliente sale o se desconecta |
| `matchmaking.setReady`      | gateway → matchmaking | un jugador marca/quita su ready |
| `matchmaking.lobby.updated` | matchmaking → gateway | **en cada cambio** de la sala   |
| `matchmaking.match.found`   | matchmaking → gateway | al arrancar la partida          |

### Eventos de socket (cliente ↔ gateway)

| Evento                    | Dirección         | Payload                                 |
| ------------------------- | ----------------- | --------------------------------------- |
| `lobby:join`              | cliente → gateway | `{ lobbyId? }` (default `"main"`)       |
| `lobby:leave`             | cliente → gateway | `{ lobbyId? }`                          |
| `lobby:ready`             | cliente → gateway | `{ ready: boolean }` (marcar/quitar)    |
| `lobby:joined`            | gateway → cliente | `{ lobbyId }` (confirmación de tu join) |
| `lobby:state`             | gateway → sala    | `LobbyStatePayload` (ver §6)            |
| `matchmaking:match-found` | gateway → sala    | `MatchFoundPayload` (ver §5)            |

---

## 4. Arranque: ready de todos

En cada `join`, `leave` y `lobby:ready`, la sala se **reevalúa** y **siempre**
emite `lobby.updated` (así el frontend ve la lista y los readies en vivo). La
regla de arranque es única:

```
si count >= 2  Y  todos los jugadores tienen ready === true
   → ARRANCA
```

- `join` → el jugador entra con `ready=false`. Aunque sea el 2.º, no arranca hasta
  que todos (incluido él) den ready.
- `lobby:ready { ready }` → marca o quita el ready de ese jugador (es un **toggle**).
- `leave` / desconexión → quita al jugador; puede que los restantes ya estén todos
  ready → arranca.

**Pueden entrar jugadores mientras se da ready**: el nuevo entra `ready=false`, así
que la condición deja de cumplirse hasta que él también lo dé. A los que ya estaban
ready **no se les resetea**.

**Arrancar** = sacar a **todos** los jugadores de la sala (todos están ready),
asignar roles (§5) y emitir `match.found`. Si la publicación a NATS falla, los
jugadores **se devuelven** a la sala (no se pierden). El `max` (8) es solo el tope
de capacidad de la sala; ya **no** provoca un arranque automático al llenarse.

Ejemplo (min=2):

```
alice ✗ · bob ✗                ← 2 en sala, nadie ready → no arranca
alice ✓ · bob ✗                ← falta bob → no arranca
alice ✓ · bob ✓                ← todos ready y ≥2 → match.found con los 2

(si entra charlie antes de arrancar)
alice ✓ · bob ✓ · charlie ✗    ← charlie no-ready → espera
alice ✓ · bob ✓ · charlie ✓    ← todos ready → arranca con los 3
```

---

## 5. Asignación de roles (hider / seeker)

Al arrancar, de entre los jugadores que entran a la partida:

- **1 `seeker` al azar**.
- **el resto, `hiders`**.

Va dentro del `match.found` (un seeker garantizado por partida):

```ts
type PlayerRole = "hider" | "seeker";

interface MatchFoundPayload {
  lobbyId?: string;
  gameId: string; // uuid de la partida
  players: { userId: string; role: PlayerRole }[];
}
```

Solo la asignación **inicial**. La **rotación** de roles entre rondas vive en el
sub-proyecto de rondas (fuera de alcance).

---

## 6. Qué consume el frontend

La pantalla `/lobby` (trabajo de frontend aparte) usa eventos de socket; **no hace
falta ningún endpoint HTTP**:

- **`lobby:state`** en cada cambio → pinta la lista de jugadores **con su `ready`
  (✓/✗)**, el contador `count/max`, y el botón "Ready":

  ```ts
  interface LobbyStatePayload {
    lobbyId: string;
    players: { userId: string; username: string; ready: boolean }[]; // sin socketId
    count: number;
    min: number; // 2
    max: number; // 8
  }
  ```

  El front busca su propio `userId` en `players` para saber si ya dio ready y
  resaltar su fila/botón.

- **Botón "Ready"** (toggle) → `socket.emit("lobby:ready", { ready })`. El servidor
  reemite `lobby:state` a todos, así que todos ven el cambio al instante.

- **`matchmaking:match-found`** cuando todos están ready → el cliente navega a
  `/game`.

El front **no decide** cuándo arranca: solo pinta y manda su ready. El servidor
decide (≥ 2 y todos ready).

---

## 7. Parámetros (config / envs)

En `apps/matchmaking-service/.env` (validados con joi en `config/envs.ts`):

| Variable                  | Default | Qué controla                                        |
| ------------------------- | ------- | --------------------------------------------------- |
| `MATCHMAKING_MIN_PLAYERS` | `2`     | mínimo de jugadores para poder arrancar             |
| `MATCHMAKING_MAX_PLAYERS` | `8`     | capacidad máxima de la sala (tope; no arranca sola) |

Regla: `2 ≤ MIN ≤ MAX`. La env `MATCHMAKING_COUNTDOWN_MS` **ya no existe**: el
arranque es por ready, no por cuenta atrás.

> En macOS el contenedor no recarga solo al cambiar el `.env`:
> `docker compose up -d --build matchmaking-service`.

---

## 8. Servicios y archivos implicados

| Pieza                 | Responsabilidad                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `realtime-gateway`    | Verifica el JWT del socket, mete al cliente en la room `lobby:<id>` y traduce socket ↔ NATS. Difunde `lobby:state` y `match.found`. |
| `matchmaking-service` | **Posee la sala**: cola, llenado, ready-check y asignación de roles. No toca BD ni movimiento.                                      |
| `shared-events`       | Subjects `matchmaking.*` y eventos de socket (`lobby:state`, …).                                                                    |
| `shared-types`        | `LobbyStatePayload`, `MatchFoundPayload`, `PlayerRole`.                                                                             |
| `game-service`        | Recoge `match.found` para crear el `Game` y correr el loop. **Fuera de este doc.**                                                  |

---

## 9. Cómo comprobar que funciona

La sala se prueba con clientes Socket.IO (ver [`realtime-postman.md`](realtime-postman.md)
para el handshake con `?token={{accessToken}}`):

1. Abre **2+** conexiones Socket.IO, cada una con un usuario distinto, y envía
   `lobby:join` con el mismo `lobbyId` en todas.
2. Observa **`lobby:state`** en cada cliente: el `count` sube y los `players`
   aparecen con `ready: false`.
3. Cada cliente envía `lobby:ready { ready: true }`. En cada envío, todos reciben
   un `lobby:state` con el `ready` actualizado.
4. Cuando **todos** están ready y hay **≥ 2** → todos reciben
   **`matchmaking:match-found`** con el mismo `gameId` y **exactamente un `seeker`**.
5. Un cliente puede desmarcarse con `lobby:ready { ready: false }`: la partida no
   arranca hasta que vuelva a estar listo.

---

## 10. Fuera de alcance (futuro)

- **El `game-service` / loop de movimiento** (recoge `match.found`).
- **Múltiples salas, crear/unirse, navegador de salas** (Fase 6 UI).
- **Persistencia** de la sala (es efímera) y creación de la fila `Game`.
- **Reconexión** a la sala, salas privadas/invitaciones.
- **Rotación** de roles entre rondas (la asignación inicial sí entra aquí).
- **La pantalla `/lobby`** del frontend.
