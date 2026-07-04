# Demo del mapa movido por el back

Guía para arrancar el **spike de prueba** (`entrega-mapa/play.html`): un cliente Three.js mínimo que se conecta al back real y **solo pinta** lo que decide el servidor. Sirve para ver el mapa (`beta-city.glb`) con el jugador moviéndose, con toda la lógica (movimiento, colisión, altura) en el `game-service`.

> ⚠️ `entrega-mapa/` (play.html, token.txt, glb) y `docs/superpowers/tools/play-override.yml` son **locales de prueba** — no forman parte del producto. El código del juego vive en `apps/game-service`.

---

## 1. Qué se ha implementado (todo autoritativo en el back)

Pipeline completo por el servidor: **auth (JWT) → lobby → matchmaking → `game:join` → loop a 20 fps → snapshot**. El cliente solo manda intención de teclas y pinta el snapshot.

Dentro de `game-service` (`GameSession.tick`):

| Qué                     | Cómo                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| **Movimiento**          | Control tank: el cliente manda `forward`/`turn`; el server decide posición y `heading`.     |
| **Límites del mapa**    | `bounds` reales del descriptor → el jugador no se sale del área jugable.                    |
| **Edificios**           | `obstacles` (rectángulos AABB) → no se atraviesan ni se suben.                              |
| **Rampas / escalones**  | `heightmap` + `maxStep` → sube rampas suaves; frena en muros, bordillos, tejados y árboles. |
| **Sin caídas al vacío** | Celdas sin suelo (`null`) bloqueadas.                                                       |

**Geometría data-driven**: toda la forma del mapa vive en un JSON por mapa (`apps/game-service/src/game/maps/<nombre>.json`). Cambiar de mapa = generar otro JSON y apuntar la env `GAME_MAP`. **Cero cambios de código.**

Controles: **W/S** avanzar/retroceder, **A/D** girar.

---

## 2. Parsear un mapa nuevo (script de extracción)

Cuando cambie el `.glb` del mapa (o el mapa final), hay que **regenerar el descriptor** con el script. Lee el GLB y saca: `bounds` (área jugable), `obstacles` (edificios) y `heightmap` (alturas del suelo por celda).

```bash
node apps/game-service/scripts/extract-map.mjs <archivo.glb> [opciones]
```

Ejemplo con el mapa demo:

```bash
node apps/game-service/scripts/extract-map.mjs entrega-mapa/beta-city.glb --name beta-city --min-height 0.8
```

Opciones:

| Flag           | Default     | Qué hace                                                                                                                          |
| -------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `--name`       | `beta-city` | Nombre del JSON de salida (`maps/<name>.json`).                                                                                   |
| `--offset-x`   | `-8.5`      | Offset X para centrar el mapa (debe coincidir con el que usa el cliente al colocar el GLB).                                       |
| `--offset-z`   | `-0.3`      | Offset Z de centrado.                                                                                                             |
| `--min-height` | `1`         | Altura mínima para considerar una malla "edificio" (obstáculo). Árboles/farolas quedan por debajo. En beta-city hace falta `0.8`. |
| `--margin`     | `1`         | Calle alrededor de los edificios que se añade al área jugable.                                                                    |
| `--cell`       | `0.25`      | Resolución del heightmap (tamaño de celda).                                                                                       |

El script escribe `apps/game-service/src/game/maps/<name>.json` y valida el resultado (self-check).

> **Tras regenerar el JSON hay que reconstruir el contenedor** para que llegue a `dist/` (ver §5), porque el `game-service` corre compilado.

Dependencias dev que usa el script (ya instaladas en `game-service`): `@gltf-transform/core`, `@gltf-transform/extensions`, `draco3dgltf` (el GLB va comprimido con Draco) y `three` (raycasting del heightmap).

### Afinar la altura (`GAME_MAX_STEP`)

`GAME_MAX_STEP` es el desnivel máximo por tick que se permite (rampa sí, escalón/muro no). Depende de las pendientes del mapa:

- Muy bajo → no subes rampas de verdad.
- Muy alto → te dejas bajar bordillos que no deberías.

Para beta-city el valor bueno es **0.11** (entre la rampa ~0.07/tick y el bordillo ~0.15/tick). Es el default en `envs.ts`. Para un mapa nuevo, mirar las pendientes reales del heightmap y ajustar.

---

## 3. Generar el token de prueba

El cliente se autentica con un **JWT** que lee de `entrega-mapa/token.txt`. Hay que firmarlo con el mismo `JWT_SECRET` que usa el back (está en el contenedor de auth). Caduca, así que se regenera cuando haga falta.

```bash
# 1) saca el secreto del contenedor de auth
SECRET=$(docker exec whoshuman-auth-service-1 printenv JWT_SECRET)

# 2) firma un JWT de 12h y escríbelo en token.txt
node -e '
const c = require("crypto");
const secret = process.env.SECRET;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const payload = {
  sub: "badfd758-d51a-4a1d-93d0-6afc20041d73", // userId de prueba
  email: "play@play.local",
  username: "play",
  iat: now,
  exp: now + 43200 // 12h
};
const data = b64({ alg: "HS256", typ: "JWT" }) + "." + b64(payload);
const sig = c.createHmac("sha256", secret).update(data).digest("base64url");
require("fs").writeFileSync("entrega-mapa/token.txt", data + "." + sig);
console.log("token nuevo, exp:", new Date((now + 43200) * 1000).toLocaleString());
' SECRET="$SECRET"
```

`sub` es el `userId`; con cualquier UUID vale (el gateway solo verifica la firma). El cliente lee `token.txt` al cargar.

> El secreto **no se pone en este documento**: se lee del contenedor. No comitear `token.txt`.

---

## 4. Override local de Docker

Para la prueba en local se levantan algunos servicios con envs de conveniencia. Está en `docs/superpowers/tools/play-override.yml` (local, no comiteado). Contenido:

```yaml
services:
  game-service:
    environment:
      GAME_MAX_STEP: "0.11" # afinado para beta-city
  realtime-gateway:
    environment:
      CORS_ORIGINS: "https://localhost,http://localhost,http://localhost:8123"
  matchmaking-service:
    environment:
      MATCHMAKING_MIN_PLAYERS: "1" # jugar solo (por defecto son 2)
  auth-service:
    environment:
      JWT_EXPIRES_IN: "12h" # token largo para la prueba
```

---

## 5. Arrancar la prueba (paso a paso)

```bash
# 1) Levantar el back con el override
docker compose -f docker-compose.yml -f docs/superpowers/tools/play-override.yml up -d --build

# 2) Si cambiaste el mapa o el código del game-service, reconstruye solo ese
docker compose -f docker-compose.yml -f docs/superpowers/tools/play-override.yml up -d --build game-service

# 3) nginx cachea la IP de los contenedores: reinícialo tras recrear servicios
docker restart whoshuman-nginx-1

# 4) Generar el token (ver §3)

# 5) Servir los archivos del cliente en el puerto 8123
cd entrega-mapa && python3 -m http.server 8123 --bind 127.0.0.1
```

Abrir 👉 **http://localhost:8123/play.html** (con `Cmd + Shift + R` para recargar sin caché).

Arriba a la derecha se ve la posición `x / z / altura` que manda el servidor (útil para depurar el mapa).

### Gotchas frecuentes

- **`connect_error: websocket error` / 502**: nginx tiene cacheada la IP vieja → `docker restart whoshuman-nginx-1`.
- **"token caducado"**: regenera el token (§3).
- **Pantalla azul / auth 500**: la base de datos está vacía (faltan migraciones). Aplicar los SQL de `prisma/migrations/` al Postgres del contenedor.
- **El mapa no carga (`Unexpected token '<'`)**: el `.glb` no está en la ruta que pide el cliente (nombre/mayúsculas).

---

## 6. Qué falta para que sea el juego completo

El movimiento + mapa + física ya es 100% autoritativo. Para el juego tipo _Just Act Natural_ faltan (todo debería ir también por el back):

- **NPCs**: la multitud entre la que se esconden los hiders; el server los mueve y los mete en el snapshot.
- **Roles con mecánica**: seeker (vista/acciones) vs hider.
- **Acción del seeker** (señalar/eliminar), validada por el server.
- **Ciclo de ronda**: temporizador, condiciones de fin, puntuación.
- **Integración**: portar el cliente del spike (`play.html`) al frontend real (`apps/frontend`).
