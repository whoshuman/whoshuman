# Matchmaking — Sala de espera (lobby)

Documento que explica **cómo funciona** el `matchmaking-service`: la sala de
espera donde los jugadores entran, **ven la sala llenarse en tiempo real** y la
partida arranca de forma controlada (countdown), repartiendo los roles.

> El transporte WebSocket lo explica [`realtime-postman.md`](realtime-postman.md).

---

## 1. Idea general

El `matchmaking-service` mantiene una **sala de espera** en memoria. No es 3D ni
tiene movimiento: eres una **entrada en una lista**. El movimiento solo existe
cuando la partida arranca (eso ya es el `game-service`, fuera de aquí).

Hay **una sala pública** (`lobbyId = "main"`). Cuando se junta suficiente gente,
el servicio asigna roles (1 seeker + el resto hiders) y emite `match.found`, que
el `game-service` recogerá para crear la partida.

Permisos: cualquier usuario autenticado puede entrar. El "quién soy" sale del
**JWT** (lo verifica el `realtime-gateway` al conectar el socket), nunca del body.

---

## 2. Estado de la sala (en memoria)

La sala es un objeto **efímero** (no toca BD): si el servicio se reinicia, se
vacía. Cada `lobbyId` tiene su propio estado:

```ts
interface Lobby {
  lobbyId: string;
  players: { userId; username; socketId }[];
  status: "waiting" | "starting";
  startsAt: number | null; // epoch ms del arranque (solo en "starting")
  countdownTimer: NodeJS.Timeout | null;
}
```

- **`waiting`** — aún no hay suficientes jugadores; no hay cuenta atrás.
- **`starting`** — se alcanzó el mínimo; hay una cuenta atrás corriendo y se
  sigue admitiendo gente hasta el máximo.

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
   │  añade a la sala → evalúa (¿countdown? ¿arranca?)
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
| `matchmaking.lobby.updated` | matchmaking → gateway | **en cada cambio** de la sala   |
| `matchmaking.match.found`   | matchmaking → gateway | al arrancar la partida          |

### Eventos de socket (cliente ↔ gateway)

| Evento                    | Dirección         | Payload                                 |
| ------------------------- | ----------------- | --------------------------------------- |
| `lobby:join`              | cliente → gateway | `{ lobbyId? }` (default `"main"`)       |
| `lobby:leave`             | cliente → gateway | `{ lobbyId? }`                          |
| `lobby:joined`            | gateway → cliente | `{ lobbyId }` (confirmación de tu join) |
| `lobby:state`             | gateway → sala    | `LobbyStatePayload` (ver §6)            |
| `matchmaking:match-found` | gateway → sala    | `MatchFoundPayload` (ver §5)            |

---

## 4. Arranque: mínimo, countdown y máximo

En cada `join` y cada `leave`, la sala se **reevalúa** y **siempre** emite
`lobby.updated` (así el frontend ve la lista en vivo). La decisión:

```
join → añade jugador
  ├─ count >= max          → ARRANCA YA (cancela countdown si lo había)
  ├─ count >= min y waiting → empieza countdown (status="starting",
  │                            startsAt = ahora + COUNTDOWN_MS)
  └─ si no                  → sigue en "waiting"

(countdown expira) → ARRANCA con los jugadores presentes

leave → quita jugador
  └─ estaba en "starting" y count < min → CANCELA el countdown (vuelve a "waiting")
```

**Arrancar** = sacar `min..max` jugadores de la sala, asignar roles (§5), emitir
`match.found`, limpiar el timer y, si quedan jugadores, reevaluar. Si la
publicación a NATS falla, los jugadores **se devuelven** a la sala (no se pierden).

Ejemplo (min=2, max=8, countdown=10s):

```
1/8 · waiting                      ← primer jugador, sin prisa
2/8 · starting (arranca en ~10s)   ← se alcanza el mínimo → cuenta atrás
3/8 · starting                     ← sigue entrando gente durante la cuenta
… (la cuenta atrás expira) →  match.found  con los 3 jugadores
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

La pantalla `/lobby` (trabajo de frontend aparte) se pinta con dos eventos de
socket; **no hace falta ningún endpoint HTTP**:

- **`lobby:state`** en cada cambio → pinta la lista, el contador `count/max`, el
  estado y el countdown (`startsAt - now`):

  ```ts
  interface LobbyStatePayload {
    lobbyId: string;
    players: { userId: string; username: string }[]; // sin socketId (interno)
    count: number;
    min: number;
    max: number;
    status: "waiting" | "starting";
    startsAt: number | null;
  }
  ```

- **`matchmaking:match-found`** al arrancar → el cliente navega a `/game`.

---

## 7. Parámetros (config / envs)

En `apps/matchmaking-service/.env` (validados con joi en `config/envs.ts`):

| Variable                   | Default | Qué controla                                    |
| -------------------------- | ------- | ----------------------------------------------- |
| `MATCHMAKING_MIN_PLAYERS`  | `2`     | mínimo para iniciar la cuenta atrás             |
| `MATCHMAKING_MAX_PLAYERS`  | `8`     | capacidad máxima; al llegar arranca al instante |
| `MATCHMAKING_COUNTDOWN_MS` | `10000` | duración de la cuenta atrás (ms)                |

Regla: `2 ≤ MIN ≤ MAX`. Por ejemplo `MATCHMAKING_MIN_PLAYERS=5` hace que la sala
espere a 5 jugadores antes de la cuenta atrás (y siga arrancando a los 8).

> En macOS el contenedor no recarga solo al cambiar el `.env`:
> `docker compose up -d --build matchmaking-service`.

---

## 8. Servicios y archivos implicados

| Pieza                 | Responsabilidad                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `realtime-gateway`    | Verifica el JWT del socket, mete al cliente en la room `lobby:<id>` y traduce socket ↔ NATS. Difunde `lobby:state` y `match.found`. |
| `matchmaking-service` | **Posee la sala**: cola, llenado, countdown, máximo y asignación de roles. No toca BD ni movimiento.                                |
| `shared-events`       | Subjects `matchmaking.*` y eventos de socket (`lobby:state`, …).                                                                    |
| `shared-types`        | `LobbyStatePayload`, `MatchFoundPayload`, `PlayerRole`.                                                                             |
| `game-service`        | Recoge `match.found` para crear el `Game` y correr el loop. **Fuera de este doc.**                                                  |

---

## 9. Cómo comprobar que funciona

La sala se prueba con clientes Socket.IO (ver [`realtime-postman.md`](realtime-postman.md)
para el handshake con `?token={{accessToken}}`):

1. Abre **varias** conexiones Socket.IO, cada una autenticada con un usuario
   distinto, y envía `lobby:join` con el mismo `lobbyId` en todas.
2. Observa el evento **`lobby:state`** en cada cliente: el `count` sube, los
   `players` aparecen y, al alcanzar `MATCHMAKING_MIN_PLAYERS`, el `status` pasa
   a `"starting"` con `startsAt`.
3. Espera a que expire la cuenta atrás **o** llega al máximo → todos reciben
   **`matchmaking:match-found`** con el mismo `gameId` y **exactamente un
   `seeker`**.
4. Si un cliente envía `lobby:leave` (o se desconecta) y la sala baja del mínimo
   durante `"starting"`, el resto recibe un `lobby:state` con `status: "waiting"`
   (cuenta atrás cancelada).

---

## 10. Fuera de alcance (futuro)

- **El `game-service` / loop de movimiento** (recoge `match.found`).
- **Múltiples salas, crear/unirse, navegador de salas** (Fase 6 UI).
- **Persistencia** de la sala (es efímera) y creación de la fila `Game`.
- **Reconexión** a la sala, salas privadas/invitaciones.
- **Rotación** de roles entre rondas (la asignación inicial sí entra aquí).
- **La pantalla `/lobby`** del frontend.
