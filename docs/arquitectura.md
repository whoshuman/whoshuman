# ft_transcendence — Documento de Arquitectura

## Proyecto inspirado en Just Act Natural

Este proyecto será una plataforma multijugador web inspirada en el juego Just Act Natural.

La arquitectura estará enfocada en:

- realtime
- multiplayer
- microservicios
- renderizado 3D
- sincronización online
- escalabilidad

---

# 1. Stack Tecnológico

## Frontend

- React
- Vite
- TypeScript
- TailwindCSS
- Zustand
- React Query
- Socket.IO Client
- Three.js
- React Three Fiber
- Drei

---

## Backend

- NestJS
- TypeScript
- Socket.IO
- NATS
- Prisma
- PostgreSQL
- JWT
- bcrypt

---

## Infraestructura

- Docker
- Docker Compose
- Nginx
- GitHub Actions
- Prometheus
- Grafana

---

# 2. ¿Por qué React?

React fue seleccionado porque:

- tiene excelente integración con Three.js
- React Three Fiber simplifica el desarrollo 3D
- funciona muy bien con realtime
- tiene un ecosistema enorme
- facilita compartir estado entre gameplay y UI

---

# 3. Three.js vs Babylon.js

## Three.js

Ventajas:

- flexible
- enorme comunidad
- integración perfecta con React
- más ligero

Desventajas:

- más manual
- requiere más arquitectura

---

## Babylon.js

Ventajas:

- más parecido a un game engine
- muchas herramientas integradas

Desventajas:

- menos flexible
- ecosistema menor
- menos integración con React

---

## Decisión final

```txt
Three.js + React Three Fiber + Drei
```

---

# 4. Arquitectura General

```txt
Arquitectura de Microservicios orientada a eventos
```

Tecnologías principales:

- NestJS
- NATS
- PostgreSQL
- Prisma
- WebSockets

---

# 5. Arquitectura Realtime

## Flujo General

```txt
Frontend React / Three.js
        │
        │ WebSocket
        ▼
Realtime Gateway
        │
        │ NATS
        ▼
Internal Microservices
```

---

## ¿Por qué usar Realtime Gateway?

El frontend NO debe conectarse directamente a todos los microservicios.

El gateway se encarga de:

- conexiones socket
- autenticación realtime
- broadcasting
- rooms
- reconexión

---

# 6. Servicios Backend

## api-gateway

Responsabilidades:

- entrada HTTP
- auth
- validaciones
- rate limiting

---

## realtime-gateway

Responsabilidades:

- WebSockets
- realtime
- rooms
- sincronización

---

## auth-service

Responsabilidades:

- login
- register
- JWT
- sesiones

---

## user-service

Responsabilidades:

- perfiles
- amigos
- estadísticas

---

## game-service

Responsabilidades:

- lógica gameplay
- estado realtime
- sincronización
- validación

---

## matchmaking-service

Responsabilidades:

- colas
- matchmaking
- creación de partidas

---

## chat-service

Responsabilidades:

- chat realtime
- mensajes
- historial

---

## notification-service

Responsabilidades:

- hub de notificaciones: recibe peticiones de notificar de cualquier ms
- persistencia del historial y estado leído/no leído
- enruta al `realtime-gateway` para la entrega en vivo
- (futuro) fan-out a otros canales (email, push)

### Flujo de notificaciones

```txt
1. Un ms (p.ej. user-service) quiere notificar
        ↓
2. emit "notifications.send"  { recipientId, type, from, data }
        ↓
3. notification-service recibe (hub)
        ↓
4. guarda Notification en PostgreSQL
        ↓
5. emit "notifications.deliver" con id, createdAt y readAt
        ↓
6. realtime-gateway → server.to("user:<recipientId>").emit("notification", …)
        ↓
7. Frontend del destinatario lo recibe en vivo y actualiza la bandeja
```

**Principio — qué pasa por el hub y qué no:**

- **Notificación durable** (solicitud de amistad, mención de chat…) → por el
  `notification-service`.
- **Señal transitoria** (estado de partida, presencia…) → **directa** al
  `realtime-gateway` (el salto por el hub no aporta nada).

Si el destinatario no está conectado se pierde únicamente el aviso WebSocket;
el registro permanece en `notifications` y la bandeja lo recupera al cargar la
app. Rechazar solicitudes y bloquear usuarios son acciones silenciosas: no
generan registros ni eventos.

---

# 7. Authoritative Server Model

El servidor controla el estado real del juego.

El cliente:

- envía input
- renderiza

El servidor:

- valida
- sincroniza
- decide

---

## Flujo realtime

```txt
1. Jugador se mueve
        ↓
2. Frontend envía socket event
        ↓
3. Realtime Gateway recibe evento
        ↓
4. Gateway publica evento NATS
        ↓
5. Game Service valida
        ↓
6. Estado actualizado
        ↓
7. Gateway retransmite
        ↓
8. Frontend renderiza
```

---

# 8. Estructura General del Monorepo

```txt
transcendence/
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
├── docs/
├── docker-compose.yml
├── pnpm-workspace.yaml
└── README.md
```

---

# 9. ¿Por qué Monorepo?

Permite:

- compartir tipos
- reutilizar código
- simplificar imports
- mantener consistencia
- trabajar mejor en equipo

---

# 10. Estructura Frontend

```txt
apps/frontend/
│
├── public/
│   ├── models/
│   ├── textures/
│   ├── maps/
│   └── sounds/
│
├── src/
│   ├── pages/
│   ├── features/
│   ├── game/
│   ├── shared/
│   ├── styles/
│   └── main.tsx
```

---

# 11. Arquitectura del Juego

```txt
src/game/
│
├── components/
├── scenes/
├── systems/
├── entities/
├── network/
├── hooks/
├── store/
└── utils/
```

---

## systems/

Aquí vive la lógica gameplay:

```txt
movement.system.ts
animation.system.ts
collision.system.ts
interpolation.system.ts
```

---

## network/

Aquí vive la comunicación realtime:

```txt
game.socket.ts
game.events.ts
game.protocol.ts
```

---

# 12. Base de Datos

## PostgreSQL

Ventajas:

- relacional
- transacciones
- estable
- excelente con Prisma

---

## Prisma

Ventajas:

- type-safe
- excelente con TypeScript
- migraciones simples

---

# 13. Assets 3D

```txt
public/
├── models/
├── textures/
├── sounds/
├── animations/
└── maps/
```

Formato recomendado:

```txt
.glb
```

---

# 14. Pipeline de Assets

```txt
Ready Player Me
        ↓
Mixamo
        ↓
Blender
        ↓
Export GLB
        ↓
Three.js
```

---

# 15. Docker

El proyecto debe ejecutarse con:

```bash
docker compose up --build
```

---

## Servicios Docker

```txt
frontend
api-gateway
realtime-gateway
auth-service
user-service
game-service
chat-service
postgres
nats
nginx
```

---

# 16. MVP Recomendado

## Fase 1

- auth
- frontend
- docker
- postgres
- prisma

---

## Fase 2

- realtime gateway
- sockets
- sincronización

---

## Fase 3

- matchmaking
- multiplayer
- chat

---

## Fase 4

- torneos
- estadísticas
- spectator mode

---

# 17. Recomendaciones

NO intentar:

- gráficos AAA
- físicas ultra complejas
- demasiados microservicios

Priorizar:

- gameplay
- realtime
- sincronización
- estabilidad
- multiplayer

---

# 18. Arquitectura Final Recomendada

```txt
Frontend
   ↓
Realtime Gateway
   ↓
NATS
   ↓
Game Service
```

---

# 19. Conclusión

La arquitectura recomendada:

```txt
React + Three.js + NestJS + NATS + Prisma + PostgreSQL
```

es moderna, escalable y muy adecuada para un juego multiplayer realtime en navegador.
