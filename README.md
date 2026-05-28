# whoshuman

## Puesta en marcha

Pasos para levantar el proyecto desde cero:

```bash
# 1. Clonar el repo
git clone https://github.com/whoshuman/whoshuman.git
cd whoshuman

# 2. Instalar dependencias
make install

# 3. Crear el certificado SSL (solo la primera vez)
make certs

# 4. Copiar las variables de entorno y editarlas
cp .env.example .env

# 5. Levantar todos los servicios
make dev
```

> **Nota:** El certificado SSL es self-signed para desarrollo local. Cada desarrollador genera el suyo propio — no se sube al repo.

---

## Comandos

### Setup

| Comando        | Descripción                          |
| -------------- | ------------------------------------ |
| `make all`     | Instala, genera certs y levanta todo |
| `make install` | Instala dependencias                 |
| `make certs`   | Genera certificados SSL self-signed  |
| `make re`      | Limpia todo y reconstruye desde cero |

### Docker

| Comando                     | Descripción                               |
| --------------------------- | ----------------------------------------- |
| `make dev`                  | Levanta todos los servicios               |
| `make dev-d`                | Levanta todos los servicios en background |
| `make db`                   | Levanta solo PostgreSQL y NATS            |
| `make down`                 | Para todos los servicios                  |
| `make purge`                | Para servicios y borra volúmenes ⚠️       |
| `make ps`                   | Ver estado de los contenedores            |
| `make stats`                | Ver CPU y memoria en tiempo real          |
| `make images`               | Listar imágenes del proyecto              |
| `make logs`                 | Ver logs de todos los servicios           |
| `make logs s=auth-service`  | Ver logs de un servicio concreto          |
| `make shell s=auth-service` | Entrar en la shell de un contenedor       |
| `make prune`                | Limpiar imágenes y caché sin usar         |

### Base de datos

| Comando         | Descripción                         |
| --------------- | ----------------------------------- |
| `make migrate`  | Ejecutar migraciones de Prisma      |
| `make generate` | Generar cliente de Prisma           |
| `make studio`   | Abrir Prisma Studio en el navegador |
| `make reset`    | Resetear la BD completamente ⚠️     |

> **DATABASE_URL según el contexto:**
>
> | Contexto                            | Host        | Puerto |
> | ----------------------------------- | ----------- | ------ |
> | Tu Mac (migraciones, Prisma Studio) | `localhost` | `5432` |
> | Servicios dentro de Docker (NestJS) | `postgres`  | `5432` |
>
> El `.env` usa `localhost` para desarrollo local. Los servicios NestJS usarán `postgres` en su configuración interna cuando se implementen.

### Limpieza

| Comando       | Descripción                                      |
| ------------- | ------------------------------------------------ |
| `make clean`  | Borra los `dist/` de todos los servicios         |
| `make fclean` | Borra `dist/`, `node_modules` y volúmenes Docker |

---

## Diferencias: Mac (host) vs Docker (servidor)

Hay ciertos comandos y configuraciones que se comportan diferente según si los ejecutas en tu Mac o dentro de los contenedores Docker:

| Aspecto             | En tu Mac (host)                  | Dentro de Docker                     |
| ------------------- | --------------------------------- | ------------------------------------ |
| `DATABASE_URL` host | `localhost`                       | `postgres`                           |
| Puerto PostgreSQL   | `5432` (expuesto por Docker)      | `5432` (red interna)                 |
| Migraciones Prisma  | `make migrate` (desde Mac)        | No se ejecutan dentro del contenedor |
| Prisma Studio       | `make studio` (abre en navegador) | No aplica                            |
| SSL certs           | Generados con `make certs`        | Montados como volumen read-only      |
| Node.js / npm       | Instalado en el sistema           | Incluido en cada imagen Docker       |

> **Regla general:** Las migraciones, Prisma Studio y los comandos `make` se ejecutan **siempre desde tu Mac**. Los servicios NestJS corren **dentro de Docker** y usan la red interna con el hostname `postgres`.

---

## Solución de problemas

### `npm install` se queda colgado en Mac (Apple Silicon M1/M2/M3/M4)

A veces `npm install` se congela sin dar ningún error, especialmente en Macs con chip Apple Silicon. Solución:

```bash
# 1. Matar procesos npm zombies
pkill -f "npm install" 2>/dev/null || true

# 2. Limpiar completamente
rm -rf node_modules package-lock.json
npm cache clean --force

# 3. Reinstalar
npm install
```

> Si el problema persiste, prueba cerrando y reabriendo el terminal antes del paso 3.

### PostgreSQL no acepta conexiones desde el host

Asegúrate de que el contenedor de postgres está corriendo y el puerto está expuesto:

```bash
make db       # levanta solo PostgreSQL y NATS
make ps       # verifica que postgres está healthy
```

El `.env` debe usar `localhost` (no `postgres`) para los comandos que se ejecutan desde Mac:

```
DATABASE_URL=postgresql://whoshuman:changeme@localhost:5432/whoshuman
```

---

## Estructura del proyecto

```text
whoshuman/
│
├── apps/
│   ├── frontend/
│   ├── api-gateway/
│   ├── realtime-gateway/
│   ├── auth-service/
│   ├── user-service/
│   ├── game-service/
│   ├── matchmaking-service/
│   ├── chat-service/
│   └── notification-service/
│
├── packages/
│   ├── shared-types/
│   ├── shared-utils/
│   ├── shared-events/
│   ├── shared-validation/
│   └── ui-components/
│
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   ├── monitoring/
│   └── scripts/
│
├── prisma/
│
├── docs/
│
├── .env
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── README.md
```
