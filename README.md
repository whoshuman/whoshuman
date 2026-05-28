# whoshuman

## Puesta en marcha

Pasos para levantar el proyecto desde cero:

```bash
# 1. Clonar el repo
git clone https://github.com/whoshuman/whoshuman.git
cd whoshuman

# 2. Instalar dependencias
npm install

# 3. Crear el certificado SSL (solo la primera vez)
./infrastructure/scripts/generate-certs.sh

# 4. Copiar las variables de entorno y editarlas
cp .env.example .env

# 5. Levantar todos los servicios
docker compose up --build
```

> **Nota:** El certificado SSL es self-signed para desarrollo local. Cada desarrollador genera el suyo propio — no se sube al repo.

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
