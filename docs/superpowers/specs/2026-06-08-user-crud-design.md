# Diseño: CRUD de usuarios + búsqueda (user-service)

Fecha: 2026-06-08

## Objetivo

Implementar los endpoints de gestión de usuarios en `user-service`: ver perfil
(propio y público), editar perfil, buscar/listar usuarios (paginado) y borrar la
cuenta con **borrado lógico (soft-delete)**. Incluye un **helper de paginación
reutilizable** (genérico, desacoplado de Prisma) en `shared-utils`.

Respeta la arquitectura: HTTP en `api-gateway` → NATS (request/reply) →
`user-service` → Prisma. La **creación** de usuarios la sigue gestionando
`auth-service` (register).

Alineado con el ROADMAP ("Standard User Management": perfil editable, página de
perfil pública).

## Decisiones tomadas

- **Operaciones:** Read + Update + Search + Delete (sin Create — es de `auth`).
- **Permisos:** self-service, **sin roles**. Cualquiera autenticado ve perfiles
  públicos y busca; solo edita/borra **su propia** cuenta (id del JWT, nunca del body).
- **Update por `PUT`:** reemplaza los campos editables (`username`, `avatar`,
  `bio`). El **email NO se toca** (campo único y fijo; su cambio es de `auth`).
- **Paginación:** offset (`page` + `limit`), por defecto 20, máximo 50.
- **`/me` separado de `/users/:id`:** handlers y DTOs distintos; el privado lleva
  email, el público no (sin lógica condicional).
- **Delete = soft-delete con anonimización:** marca `deletedAt` y reescribe
  email/username a un valor centinela (libera los valores, cumple GDPR). Borra
  sesiones y amistades; conserva el `User` (tombstone) y sus `Score`.
- **Helper `paginate`** en `shared-utils`, genérico y sin acoplar a Prisma.

## Cambio de esquema (Prisma)

Añadir a `model User`:

```prisma
deletedAt DateTime?
```

Migración aditiva (columna nullable). No se toca `@unique` de email/username:
gracias a la anonimización, los valores reales se liberan al borrar, así que el
constraint se mantiene tal cual.

## Endpoints (api-gateway, bajo `/api`, todos con `JwtAuthGuard`)

| Método   | Ruta                          | Acción                               | Respuesta                 |
| -------- | ----------------------------- | ------------------------------------ | ------------------------- |
| `GET`    | `/users/me`                   | Mi perfil privado                    | `PublicUser` (con email)  |
| `PUT`    | `/users/me`                   | Reemplazar `username`/`avatar`/`bio` | `PublicUser` actualizado  |
| `DELETE` | `/users/me`                   | Borrar mi cuenta (soft)              | `{ success: true }`       |
| `GET`    | `/users/:id`                  | Perfil público de otro               | `UserProfile` (sin email) |
| `GET`    | `/users?search=&page=&limit=` | Buscar/listar usuarios               | `Paginated<UserProfile>`  |

### Subjects NATS (`UserSubjects`)

- `users.findProfile` _(ya declarado)_ → perfil **público** por id.
- `users.updateProfile` _(ya declarado)_ → reemplazar perfil propio (PUT).
- `users.findMe` **(nuevo)** → perfil **privado** propio (con email).
- `users.deleteAccount` **(nuevo)** → soft-delete de la cuenta propia.
- `users.searchUsers` **(nuevo)** → búsqueda paginada.

El gateway inyecta el `userId` propio (del JWT) y el `targetId` (de la ruta).

## Tipos (`shared-types`)

```ts
// Perfil propio (privado) — ya existe, incluye email:
//   PublicUser { id, email, username, avatar, bio, createdAt, updatedAt }

// Perfil público (otros / búsqueda) — SIN email:
export interface UserProfile {
  id: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  createdAt: string;
}

// Paginación (tipos aquí; la función vive en shared-utils)
export interface PageQuery {
  page?: number;
  limit?: number;
}
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

// Payloads NATS. findMe / findProfile / deleteAccount reutilizan
// UserScopedPayload { userId } (ya existe del módulo de amigos).
export interface UpdateProfilePayload extends UserScopedPayload {
  username: string;
  avatar: string | null;
  bio: string | null;
}
export interface SearchUsersPayload {
  query?: string;
  page?: number;
  limit?: number;
}
```

> `findProfile`: el `userId` del payload es el **target**. `findMe`/`deleteAccount`:
> es el **propio** (lo pone el gateway desde el JWT).

## El helper `paginate` (`shared-utils`)

Genérico y **100% desacoplado de Prisma** (sin `any`, que el lint prohíbe). El
helper hace la matemática de paginación; el caller pasa funciones tipadas:

```ts
import type { PageQuery, Paginated } from "@whoshuman/shared-types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export function normalizePage(query: PageQuery): {
  page: number;
  limit: number;
  skip: number;
  take: number;
} {
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(query.limit ?? DEFAULT_LIMIT)));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export async function paginate<T>(
  query: PageQuery,
  fns: {
    findMany: (skip: number, take: number) => Promise<T[]>;
    count: () => Promise<number>;
  }
): Promise<Paginated<T>> {
  const { page, limit, skip, take } = normalizePage(query);
  const [data, total] = await Promise.all([fns.findMany(skip, take), fns.count()]);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
```

Uso en `user-service` (reutilizable por cualquier servicio con Prisma):

```ts
const USER_PUBLIC_SELECT = {
  id: true, username: true, avatar: true, bio: true, createdAt: true
} as const;

async searchUsers(payload: SearchUsersPayload): Promise<Paginated<UserProfile>> {
  const where = {
    deletedAt: null, // ← nunca mostrar cuentas borradas
    ...(payload.query
      ? { username: { contains: payload.query, mode: "insensitive" as const } }
      : {})
  };
  const result = await paginate<UserRow>(payload, {
    findMany: (skip, take) =>
      this.prisma.user.findMany({ where, orderBy: { username: "asc" }, skip, take, select: USER_PUBLIC_SELECT }),
    count: () => this.prisma.user.count({ where })
  });
  return { ...result, data: result.data.map(toUserProfile) };
}
```

**Filtros:** el `where` se construye en el servicio; añadir filtros es trivial (el
helper no cambia). En esta tarea: `search` por `username` (parcial, insensible) +
`deletedAt: null` + paginación, orden por `username` asc.

## Reglas / semántica

### Read

- `findMe`: `PublicUser` completo del propio usuario (con email). `404 userNotFound`
  si no existe **o está borrado** (`deletedAt` no es null).
- `findProfile`: `UserProfile` (sin email) por id, solo si `deletedAt: null`.
  `404` si no existe o está borrado.

### Update — `updateProfile` (PUT)

- Reemplaza `username`, `avatar`, `bio`. Semántica PUT: el body trae el estado
  completo de los campos editables; `avatar`/`bio` ausentes → `null` (se limpian).
- **Email y password fuera** (dominio de `auth-service`).
- `username` valida unicidad → `409 usernameTaken` si lo tiene otro usuario.
  (No hace falta filtrar `deletedAt`: los borrados están anonimizados, su username
  ya no es el real.)
- Devuelve el `PublicUser` actualizado.

### Delete — `deleteAccount` (soft-delete con anonimización)

En una transacción Prisma (`$transaction`):

1. Borrar `Session` del usuario (force logout).
2. Borrar `Friendship` donde `requesterId = id` o `addresseeId = id`.
3. `update` del `User`: `deletedAt = now()`, `email = "deleted_<id>@deleted.local"`,
   `username = "deleted_<id>"`, `avatar = null`, `bio = null` (anonimiza el PII).
4. **Conserva** el `User` (tombstone) y sus `Score` → no rompe el historial.

Devuelve `{ success: true }`.

> El centinela usa el `id` (uuid) → siempre único, no choca con el `@unique`.

### Search — `searchUsers`

- `where` con `deletedAt: null` + (si hay query) `username contains` insensible.
- Paginado offset con `paginate` (default 20, máx 50). Devuelve `Paginated<UserProfile>`.

## Impacto en otros servicios

- **`auth-service`: sin cambios.** Como el borrado **anonimiza** email/username,
  los valores reales quedan libres y los constraints de unicidad siguen válidos;
  register/login no necesitan filtrar `deletedAt`. Un usuario borrado no puede
  loguear (su email real ya no existe en ninguna fila activa y sus sesiones se
  borraron).

## DTOs (api-gateway, `class-validator`)

```ts
// PUT /users/me — reemplazo completo de campos editables
class UpdateProfileDto {
  @IsString()
  @MinLength(USERNAME_MIN_LENGTH)
  @MaxLength(USERNAME_MAX_LENGTH)
  username!: string;
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatar?: string | null;
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string | null;
}

// GET /users?search=&page=&limit=
class SearchUsersDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  search?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
```

(`USERNAME_MIN_LENGTH`/`MAX_LENGTH` de `@whoshuman/shared-validation`.) El gateway
pasa `avatar`/`bio` ausentes como `null` al payload (semántica PUT).

## Estructura de archivos

- `prisma/schema.prisma` — `deletedAt` en `User` + migración.
- `packages/shared-utils/src/pagination.ts` (+ export en `index.ts`) — `paginate`,
  `normalizePage`. Requiere añadir `@whoshuman/shared-types` como dependencia de
  `shared-utils` (importa `PageQuery`/`Paginated`).
- `packages/shared-types/src/index.ts` — `UserProfile`, `PageQuery`, `PageMeta`,
  `Paginated`, `UpdateProfilePayload`, `SearchUsersPayload`.
- `packages/shared-events/src/index.ts` — nuevos `UserSubjects`.
- `apps/user-service/src/users/` — `users.service.ts`, `users.controller.ts`,
  `users.module.ts` (+ spec).
- `apps/api-gateway/src/users/` — `users.controller.ts`, `users.module.ts`, `dto/`.

## Tests

- `shared-utils`: unit test de `paginate`/`normalizePage` (clamp de limit, skip/take,
  meta, `totalPages`).
- `user-service`: unit tests del servicio (prisma mockeado): `findMe`/`findProfile`
  (incl. 404 si `deletedAt`), `updateProfile` con colisión de username (409),
  `deleteAccount` (transacción: borra sesiones/amistades, anonimiza, conserva user),
  `searchUsers` (where con `deletedAt: null`, con/sin query, mapeo a `UserProfile`).

## Fuera de alcance (documentado como futuro)

- **Upload de avatar** (storage de ficheros) — aquí `avatar` es solo una URL/string.
- **RBAC / roles**; búsqueda a escala (full-text/trigram/motor dedicado);
  paginación por cursor.
- **Presence** (online/offline en realtime), **OAuth**, cambio de email/password
  (dominio de `auth-service`).
- **Restaurar cuenta** borrada (con anonimización no es trivial; no se contempla).
