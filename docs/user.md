# Gestión de Usuarios (CRUD + búsqueda)

Documento que explica **cómo funciona** la gestión de perfiles de usuario: los
endpoints, la separación entre perfil propio y público, la **paginación
reutilizable** y el **borrado lógico (soft-delete)** con anonimización.

> El sistema de amigos tiene su propio doc: [`friendly.md`](friendly.md).

---

## 1. Idea general

El `user-service` gestiona los **perfiles**: verlos, editarlos, buscarlos y
borrar la cuenta. La **creación** de usuarios NO está aquí: la hace
`auth-service` en el registro (es quien maneja contraseñas).

Permisos: **self-service, sin roles**. Cualquier usuario autenticado puede ver
perfiles públicos y buscar, pero solo puede **editar o borrar su propia
cuenta**. El "quién soy" sale **siempre del JWT** (lo inyecta el api-gateway),
nunca del body — así nadie puede editar la cuenta de otro.

---

## 2. Endpoints

Todos bajo `/api`, protegidos con `JwtAuthGuard` (Bearer token):

| Método   | Ruta                              | Qué hace                              | Devuelve                  |
| -------- | --------------------------------- | ------------------------------------- | ------------------------- |
| `GET`    | `/api/users/me`                   | Mi perfil **privado**                 | `PublicUser` (CON email)  |
| `PUT`    | `/api/users/me`                   | Reemplazar `username`/`avatar`/`bio`  | `PublicUser` actualizado  |
| `DELETE` | `/api/users/me`                   | Borrar mi cuenta (**borrado lógico**) | `{ "success": true }`     |
| `GET`    | `/api/users/:id`                  | Perfil **público** de otro usuario    | `UserProfile` (SIN email) |
| `GET`    | `/api/users?search=&page=&limit=` | Buscar/listar usuarios (paginado)     | `Paginated<UserProfile>`  |

### Perfil propio vs perfil público (privacidad)

Son **dos métodos separados a propósito**, sin lógica condicional:

- `findMe` → `PublicUser` completo (con `email`): solo lo recibes de ti mismo.
- `findProfile` / `searchUsers` → `UserProfile` reducido (**sin email**), usando
  un `select` de Prisma que ni siquiera trae el campo de la BD.

Si fuera un único método con un `if (esElMismo) incluirEmail`, un bug en esa
condición filtraría emails. Separándolos, el error es estructuralmente
imposible.

### Update por PUT (no PATCH)

`PUT /users/me` **reemplaza** los campos editables: el body trae el estado
completo de `username`, `avatar` y `bio`. Si `avatar` o `bio` no vienen, se
guardan como `null` (se limpian). El **email no se puede tocar**: es único,
fijo, y su gestión (igual que la contraseña) pertenece a `auth-service`.

Si el `username` nuevo ya lo usa **otro** usuario → `409 usernameTaken`.

---

## 3. Cómo viaja una petición

Mismo patrón request/reply que el resto del proyecto:

```
Frontend
   │  HTTP (GET /api/users/me, …)  + Bearer token
   ▼
api-gateway (UsersController)
   │  - JwtAuthGuard valida el token
   │  - inyecta userId = user.sub (del JWT) en el payload
   │  messaging.request(UserSubjects.xxx, payload)
   ▼  NATS
user-service (UsersController @MessagePattern → UsersService)
   │  Prisma → PostgreSQL
   ▼
   respuesta por NATS → api-gateway → JSON al frontend
```

Subjects NATS: `users.findMe`, `users.findProfile`, `users.updateProfile`,
`users.deleteAccount`, `users.searchUsers`.

> Ojo al **orden de las rutas** en el gateway: `me` y la búsqueda se declaran
> **antes** que `:id`, porque si no, "me" se interpretaría como un id.

---

## 4. Paginación (helper reutilizable)

### El problema

Cualquier listado (usuarios, historial, mensajes…) necesita lo mismo: leer
`page`/`limit`, validarlos, calcular `skip`/`take`, hacer el `findMany` y el
`count`, y montar la respuesta con metadatos. Repetir eso en cada servicio es
código duplicado y bugs duplicados.

### La solución: `paginate` en `@whoshuman/shared-utils`

Una función **genérica** que hace la matemática de paginación y deja que cada
servicio ponga sus propias queries. No conoce Prisma (recibe funciones), así
que sirve para cualquier modelo y cualquier servicio:

```ts
paginate<T>(query, {
  findMany: (skip, take) => Promise<T[]>, // tu query con skip/take
  count: () => Promise<number> //            tu count con el mismo where
});
```

- Defaults: `page=1`, `limit=20`. Máximo: `limit=50` (se recorta solo).
- Valores raros (`page=-5`, `limit=0`, `limit=9999`) se normalizan, nunca rompen.
- `findMany` y `count` se ejecutan **en paralelo** (`Promise.all`).

### Ejemplo real (búsqueda de usuarios)

```ts
const where = {
  deletedAt: null, //              nunca mostrar cuentas borradas (ver §5)
  id: { not: payload.userId }, //  el que busca no se encuentra a sí mismo
  username: { contains: "bo", mode: "insensitive" }
};

const result = await paginate<PublicUserRow>(payload, {
  findMany: (skip, take) =>
    prisma.user.findMany({
      where,
      orderBy: { username: "asc" },
      skip,
      take,
      select: PUBLIC_SELECT
    }),
  count: () => prisma.user.count({ where })
});
```

### Ejemplo de petición y respuesta

```
GET /api/users?search=bo&page=1&limit=2
```

```json
{
  "data": [
    { "id": "f03…", "username": "bob42", "avatar": null, "bio": null, "createdAt": "2026-06-04T…" },
    {
      "id": "a1c…",
      "username": "boris",
      "avatar": null,
      "bio": "hola",
      "createdAt": "2026-06-05T…"
    }
  ],
  "meta": { "page": 1, "limit": 2, "total": 5, "totalPages": 3 }
}
```

Con `meta` el frontend sabe pintar la paginación: 5 resultados, 3 páginas.

### Reutilizarlo en otro servicio (p. ej. historial de partidas)

```ts
import { paginate } from "@whoshuman/shared-utils";

return paginate<GameRow>(query, {
  findMany: (skip, take) =>
    prisma.game.findMany({
      where: { status: "ENDED" },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),
  count: () => prisma.game.count({ where: { status: "ENDED" } })
});
```

Mismo envelope `{ data, meta }` en toda la API, cero código repetido. Añadir
**filtros** nuevos es trivial: se amplía el `where` del servicio; el helper no
cambia.

---

## 5. Borrado lógico (soft-delete) con anonimización

### Qué es y por qué

Al borrar la cuenta **no se elimina la fila** de la BD: se marca con una fecha
(`deletedAt`) y se **anonimiza**. La fila superviviente se llama _tombstone_
(lápida). ¿Por qué así y no un `DELETE` físico?

- Los `Score` del usuario apuntan a su fila: borrarla **rompería el historial
  de partidas** de los demás jugadores.
- Reescribir email/username elimina el dato personal (**GDPR**) y a la vez
  **libera** esos valores para que otra persona pueda registrarse con ellos.

### Qué pasa exactamente al hacer `DELETE /users/me`

Todo en **una transacción** (o se hace entero, o nada):

```
1. Se borran sus Session      → logout forzado: no puede refrescar el token
2. Se borran sus Friendship   → desaparece de las listas de amigos de los demás
3. Se anonimiza el User       → deletedAt = ahora
                                 email    = deleted_<id>@deleted.local
                                 username = deleted_<id>
                                 avatar   = null, bio = null
   (se CONSERVAN la fila User y sus Score)
```

### Ejemplo: la fila antes y después

| Campo       | Antes          | Después                            |
| ----------- | -------------- | ---------------------------------- |
| `email`     | `edu@test.com` | `deleted_e351a367-…@deleted.local` |
| `username`  | `edu`          | `deleted_e351a367-…`               |
| `bio`       | `"Hola!"`      | `null`                             |
| `deletedAt` | `null`         | `2026-06-09T21:52:00Z`             |

El centinela usa el **id (uuid)** del usuario → es único por construcción y
nunca choca con los `@unique` de email/username. Por eso `auth-service` **no
necesita ningún cambio**: `edu@test.com` queda libre y alguien puede volver a
registrarse con él.

### La regla de oro: todo filtra `deletedAt: null`

Una cuenta borrada **no existe** de cara a la API. Todas las queries lo
aplican:

| Operación        | Comportamiento con cuenta borrada                           |
| ---------------- | ----------------------------------------------------------- |
| `GET /users/me`  | `404 userNotFound`                                          |
| `GET /users/:id` | `404 userNotFound`                                          |
| Búsqueda         | No aparece en los resultados (`where: { deletedAt: null }`) |
| `PUT /users/me`  | `404 userNotFound` — ver nota de seguridad ↓                |

> **Nota de seguridad (el caso del tombstone):** el access token sigue siendo
> válido ~15 min después de borrarse (los JWT no se pueden revocar; las
> sesiones borradas solo impiden refrescar). Sin el filtro en `PUT /users/me`,
> en esa ventana el usuario podría **renombrar su tombstone** y deshacer la
> anonimización. Por eso el update comprueba `deletedAt: null` **antes** de
> tocar nada. Hay un test que cubre exactamente este escenario.

### Ejemplo del flujo completo

```
1. DELETE /api/users/me  (token de edu)  → 200 { "success": true }
2. GET    /api/users/me  (mismo token)   → 404 "Usuario no encontrado"
3. PUT    /api/users/me  (mismo token)   → 404  (no puede editar el tombstone)
4. GET    /api/users?search=edu          → "edu" ya no aparece
5. POST   /api/auth/register con edu@test.com → ✅ funciona (email liberado)
```

### Qué NO hace (decidido a propósito)

- **No hay restauración** de cuenta: la anonimización es irreversible.
- **No se borran los Score**: el historial de partidas se conserva (anónimo).

---

## 6. Servicios y archivos implicados

| Pieza                  | Responsabilidad                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma` | Campo `deletedAt DateTime?` en `User` (+ migración).                                              |
| `shared-types`         | `UserProfile`, `PageQuery`/`PageMeta`/`Paginated`, payloads.                                      |
| `shared-events`        | Subjects `users.findMe` / `deleteAccount` / `searchUsers` (+ existentes).                         |
| `shared-utils`         | `paginate` / `normalizePage` (genéricos, con tests propios).                                      |
| `user-service`         | `users/` (service + controller NATS) y `common/user.mappers.ts` (mappers compartidos con amigos). |
| `api-gateway`          | `users/` (rutas HTTP + DTOs con `class-validator`).                                               |

---

## 7. Cómo probarlo

En Postman: carpeta **Users** (colección `whoshuman.postman_collection.json`).
Necesitas estar logueado (`Auth > Login`) para tener `{{accessToken}}`.

| Request             | Qué comprobar                                                        |
| ------------------- | -------------------------------------------------------------------- |
| `Get Me`            | Tu perfil **con** email                                              |
| `Update Me`         | Cambia `bio` y vuelve a `Get Me`: persiste. Username de otro → `409` |
| `Get Profile By Id` | Perfil de `{{userBId}}` **sin** email                                |
| `Search Users`      | `?search={{userSearch}}` → `data` + `meta` de paginación             |
| `Delete Me`         | `200`; después `Get Me` → `404` y ya no sales en `Search Users`      |

En BD (`pnpm db:studio`): tras `Delete Me`, la fila sigue en `users` pero
anonimizada y con `deletedAt` puesto.

## 8. Fuera de alcance (futuro)

- **Upload de avatar** (storage de ficheros): aquí `avatar` es solo una URL.
- **Estadísticas** del usuario (responsabilidad de user-service según
  arquitectura; sin planificar todavía).
- **Presence** (online/offline), **RBAC/roles**, búsqueda a escala
  (full-text/trigram), paginación por cursor.
- Cambio de email/contraseña → flujos de `auth-service`.
