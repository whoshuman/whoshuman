# whoshuman

## Puesta en marcha

Pasos para levantar el proyecto desde cero:

```bash
# 1. Clonar el repo
git clone https://github.com/whoshuman/whoshuman.git
cd whoshuman

# 2. Instalar dependencias
pnpm install

# 3. Crear el certificado SSL (solo la primera vez)
./infrastructure/scripts/generate-certs.sh

# 4. Copiar las variables de entorno y editarlas
cp infrastructure/postgres/.env.example infrastructure/postgres/.env
cp apps/api-gateway/.env.example apps/api-gateway/.env
cp apps/realtime-gateway/.env.example apps/realtime-gateway/.env
cp apps/auth-service/.env.example apps/auth-service/.env
cp apps/user-service/.env.example apps/user-service/.env
cp apps/game-service/.env.example apps/game-service/.env
cp apps/matchmaking-service/.env.example apps/matchmaking-service/.env
cp apps/chat-service/.env.example apps/chat-service/.env
cp apps/notification-service/.env.example apps/notification-service/.env

# 5. Levantar todos los servicios
docker compose up --build
```

> **Nota:** El certificado SSL es self-signed para desarrollo local. Cada desarrollador genera el suyo propio — no se sube al repo.

> **Backend:** los microservicios NestJS usan NATS como transporte interno. En esta fase solo existe el scaffolding y la conexion base; no hay endpoints ni handlers funcionales implementados.

> **Docker:** `docker-compose.yml` usa los `Dockerfile.dev` para desarrollo local con `start:dev`. Los `Dockerfile` sin sufijo quedan reservados para builds de produccion/CI.

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
