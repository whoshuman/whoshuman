# Sistema de Amistades

Documento que explica **cómo funciona** la funcionalidad de amigos: el modelo de
datos, los estados, las acciones disponibles, cómo viajan las peticiones entre
servicios y cómo se notifica en vivo a los usuarios.

> Diseño detallado (decisiones, trade-offs) en
> [`superpowers/specs/2026-06-04-friends-list-design.md`](superpowers/specs/2026-06-04-friends-list-design.md).

---

## 1. Idea general

Un usuario puede **enviar solicitudes de amistad** a otros. El destinatario las
**acepta** o **rechaza**. Dos usuarios se consideran amigos solo cuando la
solicitud está **aceptada**. Además, un usuario puede **bloquear** a otro para
impedir que le envíe solicitudes.

La amistad **no** se guarda como una lista de uuids dentro del usuario, sino
como una **tabla de relación** (`Friendship`) entre dos usuarios. Esto da
integridad referencial, permite estados, fechas y consultas eficientes en ambos
sentidos.

---

## 2. Modelo de datos

Tabla `friendships` (en `prisma/schema.prisma`):

| Campo                     | Significado                                         |
| ------------------------- | --------------------------------------------------- |
| `id`                      | Identificador de la relación (uuid).                |
| `requesterId`             | Quien **envía** la solicitud (o quien **bloquea**). |
| `addresseeId`             | Quien **recibe** la solicitud (o el **bloqueado**). |
| `status`                  | `PENDING` · `ACCEPTED` · `BLOCKED`.                 |
| `createdAt` / `updatedAt` | Fechas de creación y última actualización.          |

Restricción `@@unique([requesterId, addresseeId])`: no puede haber dos filas con
el mismo par solicitante→destinatario.

### Estados (`FriendshipStatus`)

| Estado     | Qué significa                                            |
| ---------- | -------------------------------------------------------- |
| `PENDING`  | Solicitud enviada, esperando respuesta del destinatario. |
| `ACCEPTED` | Los dos usuarios son amigos.                             |
| `BLOCKED`  | `requesterId` ha bloqueado a `addresseeId`.              |

### Ciclo de vida

```
                 enviar solicitud
   (sin relación) ───────────────▶ PENDING
                                     │
                  acepta destinatario│      rechaza destinatario
                                     ▼                 │
                                 ACCEPTED              ▼
                                     │            (fila borrada)
                       eliminar amigo│
                                     ▼
                               (fila borrada)

   bloquear:  (cualquier estado) ──▶ BLOCKED
   desbloquear: BLOCKED ──────────▶ (fila borrada)
```

> **Nota importante sobre el bloqueo:** el `@@unique` es **direccional**, así que
> a nivel de base de datos no impide por sí solo una relación en sentido
> contrario. Por eso la regla "un usuario bloqueado no puede mandar más
> solicitudes" se comprueba en **lógica de aplicación**: antes de crear una
> solicitud se mira si existe ya una relación `BLOCKED` en **cualquiera de los
> dos sentidos**.

---

## 3. Acciones disponibles

Todas las acciones viven en el `user-service` y se exponen al frontend como
rutas HTTP en el `api-gateway`.

| Acción                 | Qué hace                                                                  | Quién puede                                               |
| ---------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| Enviar solicitud       | Crea una relación `PENDING`.                                              | Cualquier usuario (no a sí mismo, no si ya hay relación). |
| Aceptar solicitud      | Pasa la relación a `ACCEPTED`.                                            | Solo el `addressee`.                                      |
| **Rechazar solicitud** | **Borra la relación `PENDING`** (no se guarda ningún estado "rechazada"). | Solo el `addressee`.                                      |
| Listar amigos          | Devuelve las relaciones `ACCEPTED`.                                       | El propio usuario.                                        |
| Listar pendientes      | Devuelve las solicitudes `PENDING` recibidas.                             | El propio usuario.                                        |
| Eliminar amigo         | Borra una relación `ACCEPTED`.                                            | Cualquiera de los dos.                                    |
| Bloquear               | Crea/actualiza la relación a `BLOCKED`.                                   | Quien bloquea.                                            |
| Desbloquear            | Borra la relación `BLOCKED`.                                              | Quien bloqueó.                                            |

### Rechazar = borrar (no existe estado "rechazada")

Cuando el destinatario **rechaza** una solicitud, la fila se **borra**. No se
guarda un estado `REJECTED`: para el sistema es como si la solicitud nunca se
hubiera enviado. Esto mantiene el enum limpio y evita acumular filas muertas.

Consecuencia: el solicitante **podría volver a enviar** otra solicitud más
tarde. Si alguien se vuelve pesado, la herramienta para cortarlo es el
**bloqueo** (ver abajo), no un estado de rechazo.

### Reglas de negocio

- No puedes enviarte una solicitud a ti mismo.
- No puedes enviar solicitud si **ya existe una relación** con esa persona en
  **cualquier sentido** (pendiente, aceptada o bloqueada): solo puede existir
  una relación por pareja de usuarios.
- Solo el destinatario de una solicitud puede aceptarla o rechazarla.

### Bloqueo silencioso (información sensible)

El bloqueo **nunca debe ser visible para el bloqueado**: que alguien sepa que le
has bloqueado es información sensible. Por eso, cuando un usuario **bloqueado**
(A, bloqueado por B) intenta enviar una solicitud a quien le bloqueó (B):

- ❌ **No** se crea ninguna fila.
- ❌ **No** se emite ningún evento → a B **no le llega** ninguna notificación.
- ✅ A recibe una respuesta **idéntica a la de un envío correcto**.

Es decir, para el bloqueado "enviar solicitud" **siempre parece funcionar**,
pero internamente no hace nada. La respuesta tiene que ser **indistinguible** de
un envío real: si devolviéramos un error ("estás bloqueado") o incluso un "ya
existe relación", estaríamos filtrando el bloqueo.

#### Orden de comprobaciones al enviar una solicitud

El `user-service` comprueba **en este orden** y se detiene en la primera que
aplique:

1. **¿El solicitante es el mismo destinatario?** → error `cannotFriendYourself`.
2. **¿Existe una relación `BLOCKED` en cualquier sentido?** → devolver
   **éxito falso** y parar. Silencioso, sin crear fila ni emitir evento.
3. **¿Existe ya otra relación (`PENDING` / `ACCEPTED`)?** → aquí **sí** se puede
   informar con normalidad (`alreadyFriends` / "ya existe una solicitud"),
   porque eso **no** es información sensible.
4. Si no aplica ninguna → crear la solicitud `PENDING` y emitir la notificación.

---

## 4. Cómo viaja una petición (request/reply)

Las acciones usan el patrón **petición/respuesta sobre NATS**, igual que el
login. El frontend nunca habla con el `user-service` directamente: pasa siempre
por el `api-gateway`.

```
Frontend
   │  HTTP  (POST /friends/requests, etc.)  + Bearer token
   ▼
api-gateway (FriendsController)
   │  - JwtAuthGuard valida el token y rellena el usuario actual
   │  - el requesterId/userId sale del JWT (@CurrentUser → user.sub), NO del body
   │  messaging.request(UserSubjects.xxx, payload)
   ▼  NATS
user-service (FriendsController @MessagePattern)
   │  delega en FriendsService → Prisma → PostgreSQL
   ▼
   responde de vuelta por NATS → api-gateway → JSON al frontend
```

### Subjects NATS (`packages/shared-events`)

| Subject                      | Acción                        |
| ---------------------------- | ----------------------------- |
| `users.sendFriendRequest`    | Enviar solicitud              |
| `users.respondFriendRequest` | Aceptar / rechazar            |
| `users.removeFriend`         | Eliminar amigo                |
| `users.blockUser`            | Bloquear                      |
| `users.unblockUser`          | Desbloquear                   |
| `users.findFriends`          | Listar amigos                 |
| `users.findPendingRequests`  | Listar solicitudes pendientes |

Los errores se devuelven como `RpcException({ statusCode, message })`, donde
`message` es una **clave de traducción** (i18n), no texto literal. El
`api-gateway` la localiza al idioma de la petición.

---

## 5. Notificaciones en vivo (eventos + WebSocket)

Además de la respuesta inmediata, ciertos cambios **avisan en vivo** al otro
usuario por WebSocket, sin que tenga que recargar. Esto usa el patrón de
**eventos** (fire-and-forget) + el `realtime-gateway`.

```
user-service
   │  client.emit(evento, payload)     (tras crear/aceptar solicitud)
   ▼  NATS (evento)
realtime-gateway (RealtimeEventsController @EventPattern)
   │  busca la "room" del usuario destino:  user:${userId}
   │  server.to(room).emit(socketEvent, payload)
   ▼  WebSocket
Frontend del usuario destinatario
```

Cada socket se une a su propia room `user:${userId}` al conectarse
(`handleConnection`), así el gateway puede dirigir un mensaje a **un usuario
concreto**.

| Evento NATS                   | Cuándo                   | Avisa a                 | Evento de socket          |
| ----------------------------- | ------------------------ | ----------------------- | ------------------------- |
| `users.friendRequestReceived` | al crear una solicitud   | el destinatario         | `friend:request-received` |
| `users.friendRequestAccepted` | al aceptar una solicitud | el solicitante original | `friend:request-accepted` |

> **Recordatorio del bloqueo silencioso:** el evento
> `users.friendRequestReceived` solo se emite cuando la solicitud se crea de
> verdad. Si el solicitante está bloqueado, no se crea fila ni se emite evento,
> así que el destinatario **no recibe ninguna notificación** (ver
> [Bloqueo silencioso](#bloqueo-silencioso-información-sensible)).

---

## 6. Servicios implicados

| Servicio           | Responsabilidad                                              |
| ------------------ | ------------------------------------------------------------ |
| `prisma`           | Modelo `Friendship` + migración.                             |
| `shared-types`     | Tipos `Friendship`, `FriendshipStatus`, DTOs y payloads.     |
| `shared-events`    | Subjects, eventos y eventos de socket.                       |
| `user-service`     | Lógica de amistades (service + controller) + emitir eventos. |
| `api-gateway`      | Rutas HTTP, validación de DTOs, guard de JWT.                |
| `realtime-gateway` | Recibir eventos y empujarlos por WebSocket al usuario.       |

> `PublicUser` **no cambia**: los amigos se piden por endpoints dedicados, no
> viajan dentro del usuario básico que devuelve auth.

---

## 7. Cómo comprobar que funciona

Necesitas **dos usuarios** (A y B), porque la amistad es entre dos personas. La
forma más rápida es con la colección de Postman (`whoshuman.postman_collection.json`,
carpeta **Friends**) y el entorno `whoshuman local`.

### Preparación

1. Levanta el proyecto: `docker compose up` (o `make up`).
2. **Crea/identifica dos cuentas:**
   - Usuario A: `Auth > Register` (o `Login`) con `email`/`username`. Guarda su
     `accessToken` en la variable `accessToken`.
   - Usuario B: repite el registro con las variables `userBEmail`/`userBUsername`
     y guarda su token en `userBAccessToken` y su id en `userBId`.

### Flujo principal (request/reply)

| Paso                  | Request Postman                                                | Qué debes ver                                             |
| --------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| A envía solicitud a B | `Friends > Send Request` (body `addresseeId = {{userBId}}`)    | `200 { "success": true }`                                 |
| B lista pendientes    | `Friends > List Pending` (token de B)                          | aparece la solicitud de A; copia su `id` a `friendshipId` |
| B acepta              | `Friends > Respond Request` (`{ friendshipId, accept: true }`) | `200 { "success": true }`                                 |
| A lista amigos        | `Friends > List Friends` (token de A)                          | aparece B como amigo (`status: ACCEPTED`)                 |
| A elimina amigo       | `Friends > Remove Friend` (`{{friendshipId}}`)                 | `200`; al volver a listar, ya no está                     |

### Notificaciones en vivo (WebSocket)

1. Con el usuario B, abre la conexión Socket.IO en Postman (ver
   [`realtime-postman.md`](realtime-postman.md)) usando el token de B.
2. Añade los listeners `friend:request-received` y `friend:request-accepted`.
3. Desde A, ejecuta `Friends > Send Request`. → B debe recibir al instante un
   evento `friend:request-received` con los datos de A.
4. Cuando B acepta, A (si está conectado) recibe `friend:request-accepted`.

### Comprobar el bloqueo silencioso

1. B bloquea a A: `Friends > Block` con token de B (`targetId = {{userAId}}`).
2. A intenta enviar solicitud a B: `Friends > Send Request`.
   - ✅ A recibe `200 { "success": true }` (parece que funcionó).
   - ✅ B **no** recibe ninguna notificación por WebSocket.
   - ✅ En la BD **no** se crea ninguna fila nueva (ver abajo).

### Verificación en base de datos

Con `pnpm db:studio` (Prisma Studio) abre la tabla `friendships` y comprueba:

- Tras enviar solicitud: una fila `status = PENDING`.
- Tras aceptar: esa fila pasa a `status = ACCEPTED`.
- Tras rechazar o eliminar: la fila **desaparece** (no hay estado "rechazada").
- Tras bloquear: una fila `status = BLOCKED` (`requesterId` = quien bloquea).

### Casos de error esperados

| Acción                                         | Respuesta                  |
| ---------------------------------------------- | -------------------------- |
| Enviarte solicitud a ti mismo                  | `400 cannotFriendYourself` |
| Enviar solicitud cuando ya existe (no bloqueo) | `409 alreadyFriends`       |
| Aceptar una solicitud que no es tuya           | `403 notAllowed`           |
| Responder a una solicitud inexistente          | `404 friendshipNotFound`   |
