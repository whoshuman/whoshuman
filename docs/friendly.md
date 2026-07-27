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
| Listar bloqueados      | Devuelve las relaciones `BLOCKED` creadas por el usuario.                 | El propio usuario.                                        |
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
| `users.findBlockedUsers`     | Listar usuarios bloqueados    |

Los errores se devuelven como `RpcException({ statusCode, message })`, donde
`message` es una **clave de traducción** (i18n), no texto literal. El
`api-gateway` la localiza al idioma de la petición.

---

## 5. Notificaciones persistentes (PostgreSQL + WebSocket)

Además de la respuesta inmediata, ciertos cambios **avisan en vivo** al otro
usuario por WebSocket. Las notificaciones se enrutan por el
**`notification-service`** (el hub), que primero las guarda y después las envía
al `realtime-gateway` para la entrega.

```
user-service (FriendsService)
   │  client.emit("notifications.send", envelope)   (tras crear/aceptar solicitud)
   ▼  NATS
notification-service (hub)
   │  guarda Notification en PostgreSQL
   │  publica → client.emit("notifications.deliver", record)
   ▼  NATS
realtime-gateway (RealtimeEventsController @EventPattern)
   │  server.to("user:<recipientId>").emit("notification", envelope)
   ▼  WebSocket
Frontend del destinatario
```

Cada socket se une a su room `user:${userId}` al conectarse (`handleConnection`),
así el gateway dirige el mensaje a **un usuario concreto** (todas sus pestañas).

El emisor usa un **envelope genérico**, reutilizable por cualquier servicio:

```ts
NotificationEnvelope {
  recipientId: string;   // a quién va
  type: "friend.request.received" | "friend.request.accepted";
  from: { id, username, avatar };   // actor mínimo — SIN email
  data?: { friendshipId };
}
```

Tras persistirlo, el hub entrega un `NotificationRecord` que añade `id`,
`createdAt` y `readAt`. El frontend utiliza esos campos para mantener el
historial y el contador de no leídas.

El frontend escucha **un único** evento de socket `notification` y decide según
`envelope.type`.

| `type` del envelope       | Cuándo                   | Avisa a                 |
| ------------------------- | ------------------------ | ----------------------- |
| `friend.request.received` | al crear una solicitud   | el destinatario         |
| `friend.request.accepted` | al aceptar una solicitud | el solicitante original |

> **Bloqueo silencioso:** el envelope `friend.request.received` solo se emite si
> la solicitud se crea de verdad. Si el solicitante está bloqueado, no se crea
> fila ni se emite nada → el destinatario **no recibe notificación** (ver
> [Bloqueo silencioso](#bloqueo-silencioso-información-sensible)).

> **Privacidad:** rechazar una solicitud y bloquear a alguien no crean ningún
> evento ni registro de notificación. Así no se revela una decisión sensible al
> otro usuario.

La bandeja consulta rutas autenticadas:

| Ruta                                        | Acción                   |
| ------------------------------------------- | ------------------------ |
| `GET /notifications`                        | Últimos 50 avisos        |
| `GET /notifications/unread-count`           | Contador de no leídos    |
| `PATCH /notifications/:notificationId/read` | Marcar uno como leído    |
| `PATCH /notifications/read-all`             | Marcar todos como leídos |

---

## 6. Servicios implicados

| Servicio               | Responsabilidad                                                                   |
| ---------------------- | --------------------------------------------------------------------------------- |
| `prisma`               | Modelos `Friendship` y `Notification` + migraciones.                              |
| `shared-types`         | Tipos de amistad, `NotificationEnvelope` y `NotificationRecord`.                  |
| `shared-events`        | Subjects de amistad/notificaciones y eventos de socket.                           |
| `user-service`         | Lógica de amistades + emite `notifications.send` solo al solicitar o aceptar.     |
| `notification-service` | Guarda el aviso, sirve historial/no leídos y publica `notifications.deliver`.     |
| `api-gateway`          | Rutas HTTP autenticadas, validación de DTOs y guard de JWT.                       |
| `realtime-gateway`     | Recibe `notifications.deliver` y lo empuja por WebSocket (evento `notification`). |

> `PublicUser` **no cambia**: los amigos se piden por endpoints dedicados, no
> viajan dentro del usuario básico que devuelve auth.
>
> Las relaciones incluyen únicamente el `UserProfile` público del otro usuario:
> nunca exponen su email, idioma ni datos privados de sesión.

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

La interfaz web expone estos flujos en `/friends`, mediante las pestañas de
contactos, solicitudes, búsqueda y bloqueados. Desde esta última se puede
desbloquear una unidad sin mostrar acciones contradictorias en su perfil.

### Notificaciones en vivo (WebSocket)

1. Con el usuario B, abre la conexión Socket.IO en Postman (ver
   [`realtime-postman.md`](realtime-postman.md)) usando el token de B.
2. Añade el listener `notification` (un único evento para todas las notis).
3. Desde A, ejecuta `Friends > Send Request`. → B debe recibir al instante un
   evento `notification` con `type: "friend.request.received"` y los datos de A
   (`from`, sin email).
4. Cuando B acepta, A (si está conectado) recibe un `notification` con
   `type: "friend.request.accepted"`.

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
