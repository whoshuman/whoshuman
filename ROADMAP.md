# 🗺️ ROADMAP — Who's Human

> Proyecto ft_transcendence · 42 School  
> Clon simplificado de *Just Act Natural* — juego multijugador 3D en navegador  
> Stack: React + Three.js · NestJS + NATS · PostgreSQL + Prisma · Docker

---

## 📊 Estado general

| Fase | Descripción | Semanas | Estado |
|------|-------------|---------|--------|
| 1 | Fundación del proyecto | 1–2 | ⬜ Pendiente |
| 2 | Backend microservicios | 3–4 | ⬜ Pendiente |
| 3 | Motor 3D | 5–7 | ⬜ Pendiente |
| 4 | Mecánicas de juego | 8–9 | ⬜ Pendiente |
| 5 | Módulos del subject | 10–11 | ⬜ Pendiente |
| 6 | Pulido y entrega | 12 | ⬜ Pendiente |

> **MVP jugable al final de la Fase 4** — las fases 5 y 6 añaden módulos y polish.

---

## 🎯 Puntos del subject

> Necesitamos **14 puntos mínimo** para aprobar. Cada módulo extra por encima de 14 cuenta como bonus (máximo 5 puntos de bonus).

### Módulos confirmados — 21 puntos

| Módulo | Tipo | Pts | Fase |
|--------|------|-----|------|
| Framework frontend (React) + backend (NestJS) | Major | 2 | 1 |
| Real-time WebSockets | Major | 2 | 2 |
| Backend as microservices (NATS) | Major | 2 | 2 |
| Web-based game (el juego) | Major | 2 | 4 |
| Remote players (2 jugadores online) | Major | 2 | 4 |
| Multiplayer 3+ players | Major | 2 | 4 |
| Advanced 3D graphics (Three.js) | Major | 2 | 3 |
| Monitoring — Prometheus + Grafana | Major | 2 | 6 |
| Standard user management | Major | 2 | 5 |
| ORM — Prisma | Minor | 1 | 1 |
| OAuth 2.0 — login con 42 / GitHub | Minor | 1 | 5 |
| i18n — soporte 3 idiomas (ES/EN/FR) | Minor | 1 | 5 |
| **Total** | | **21** | |

> **14 pts = aprobado · 19+ pts = bonus máximo (5 pts)**  
> Con 21 pts confirmados tenemos margen suficiente para que algún módulo falle en evaluación y seguir con bonus máximo.

---

## 📋 Fases detalladas

---

### Fase 1 — Fundación del proyecto
> **Semanas 1–2** · Módulos: Framework frontend+backend (2pts) · ORM Prisma (1pt)

Esta fase no tiene gameplay pero es la más crítica. Una mala estructura aquí cuesta semanas después.

#### Monorepo y estructura
- [ ] Inicializar repo con estructura de carpetas
  ```
  apps/frontend · apps/api-gateway · apps/realtime-gateway
  apps/auth-service · apps/user-service · apps/game-service
  apps/matchmaking-service · apps/chat-service
  packages/shared-types · packages/shared-events
  infrastructure/docker · infrastructure/nginx
  ```
- [ ] Configurar `pnpm-workspace.yaml`
- [ ] Configurar `tsconfig.json` base compartido
- [ ] Configurar ESLint + Prettier en todo el monorepo

#### Docker
- [ ] `Dockerfile` para cada servicio
- [ ] `docker-compose.yml` con todos los servicios levantando con `docker compose up --build`
- [ ] Variables de entorno en `.env` + `.env.example` (nunca subir `.env` al repo)
- [ ] Servicio PostgreSQL en Docker
- [ ] Servicio NATS en Docker
- [ ] Nginx como reverse proxy con HTTPS

#### Base de datos
- [ ] Configurar Prisma con PostgreSQL
- [ ] Schema inicial: `User`, `Session`, `Game`, `Round`, `Score`
- [ ] Primera migración: `prisma migrate dev`
- [ ] Prisma Studio funcionando para desarrollo

#### Auth service
- [ ] Registro con email + password (bcrypt, salted)
- [ ] Login con JWT (access token + refresh token)
- [ ] Guards de NestJS para rutas protegidas
- [ ] Validación de inputs con `class-validator`
- [ ] HTTPS funcionando en todas las conexiones externas

#### Frontend base
- [ ] Proyecto React + Vite + TypeScript
- [ ] Tailwind CSS configurado
- [ ] Zustand para estado global
- [ ] React Query para llamadas HTTP
- [ ] Rutas básicas: `/login`, `/register`, `/lobby`, `/game`
- [ ] Sin errores ni warnings en consola de Chrome

---

### Fase 2 — Backend microservicios
> **Semanas 3–4** · Módulos: WebSockets (2pts) · Microservicios (2pts)

Aquí se define la columna vertebral del juego. El authoritative server model es clave — el cliente solo envía inputs, el servidor decide todo.

#### API Gateway
- [ ] Entrada HTTP centralizada
- [ ] Rate limiting
- [ ] Validación y sanitización de inputs
- [ ] Proxy hacia microservicios internos

#### Realtime Gateway
- [ ] WebSocket con Socket.IO
- [ ] Sistema de rooms por partida
- [ ] Autenticación de conexiones WebSocket con JWT
- [ ] Manejo de desconexión y reconexión
- [ ] Broadcasting de estado a todos los clientes de una room

#### NATS — comunicación entre servicios
- [ ] Publicar/suscribir eventos entre microservicios
- [ ] Eventos definidos en `packages/shared-events`
  - `game.player.moved`
  - `game.player.eliminated`
  - `game.diamond.collected`
  - `game.round.ended`
  - `matchmaking.match.found`

#### Game Service
- [ ] Game loop server-side (tick rate ~20fps)
- [ ] Estado del juego autoritativo en memoria
- [ ] Validación de movimientos de jugadores
- [ ] Lógica de detección (suspicion meter)
- [ ] Sincronización y broadcast del estado

#### Matchmaking Service
- [ ] Cola de jugadores esperando partida
- [ ] Creación de sala cuando hay suficientes jugadores
- [ ] Asignación de roles (hiders / seeker)

---

### Fase 3 — Motor 3D
> **Semanas 5–7** · Módulos: Advanced 3D graphics (2pts)

> ⚠️ **Spike en semana 5** antes de comprometerse con la arquitectura: probar que el canvas de R3F + sincronización WebSocket funciona sin problemas de rendimiento.

#### Escena base
- [ ] Canvas React Three Fiber montado en la ruta `/game`
- [ ] Mapa low-poly cargado como `.glb`
- [ ] Sistema de luces (ambient + directional)
- [ ] Cámara configurada

#### Personajes
- [ ] Modelo de jugador/NPC en `.glb` (pipeline: Ready Player Me → Mixamo → Blender → GLB)
- [ ] Animaciones: idle, walk, run
- [ ] `useGLTF` de Drei para cargar modelos
- [ ] Instancing para NPCs (rendimiento con muchos personajes)

#### NPC AI
- [ ] Movimiento errático — ráfagas cortas, cambios de dirección aleatorios
- [ ] Los NPCs nunca recogen diamantes
- [ ] Pathfinding básico para evitar colisiones con el mapa

#### Seeker
- [ ] Cámara aérea con controles de apuntado
- [ ] Raycasting para seleccionar targets
- [ ] Vista diferenciada del resto de jugadores

#### Sincronización cliente-servidor
- [ ] Interpolación de posiciones recibidas del servidor
- [ ] Reconciliación de estado local vs estado del servidor
- [ ] Predicción de movimiento en cliente para reducir lag percibido

---

### Fase 4 — Mecánicas de juego
> **Semanas 8–9** · Módulos: Web-based game (2pts) · Remote players (2pts) · Multiplayer 3+ (2pts)

El MVP jugable termina aquí. Al final de esta fase se puede jugar una partida completa.

#### Diamond Grab (modo de juego principal)
- [ ] Diamantes spawneando en posiciones aleatorias del mapa
- [ ] Hiders pueden recoger diamantes
- [ ] Puntuación por diamante recogido
- [ ] NPCs ignoran los diamantes (clave para la detección)

#### Sistema de detección
- [ ] Suspicion meter visible para el seeker
- [ ] El meter sube si el jugador: se mueve demasiado recto, gira mientras camina, recoge un diamante
- [ ] El seeker dispara — si acierta, el hider es eliminado

#### Items
- [ ] **Smoke bomb** — nube de humo que oculta la zona
- [ ] **Warp** — teletransporte a posición aleatoria
- [ ] Selección de item al inicio de la ronda
- [ ] Cooldown por item

#### Sistema de rondas
- [ ] Ronda con tiempo límite (ej. 3 minutos)
- [ ] Rotación de roles entre rondas
- [ ] Pantalla de resultados entre rondas
- [ ] Puntuación acumulada por partida
- [ ] Condición de victoria (X rondas ganadas)

#### Multijugador completo
- [ ] Hasta 8 jugadores simultáneos
- [ ] Sincronización estable a 20 ticks/segundo
- [ ] Manejo de lag y desconexiones mid-game
- [ ] Reconexión a partida en curso

---

### Fase 5 — Módulos del subject
> **Semanas 10–11** · Módulos: User management (2pts) · OAuth 2.0 (1pt) · i18n (1pt)

#### Standard User Management
- [ ] Perfil editable (username, bio)
- [ ] Avatar con upload (default si no hay)
- [ ] Lista de amigos — añadir / eliminar
- [ ] Estado online/offline en tiempo real
- [ ] Página de perfil pública

#### OAuth 2.0
- [ ] Login con cuenta de 42 (intranet)
- [ ] Login con GitHub como alternativa
- [ ] NestJS Passport.js — estrategia OAuth
- [ ] Vincular cuenta OAuth a cuenta existente

#### i18n — 3 idiomas
- [ ] `react-i18next` configurado
- [ ] Español (ES) — idioma por defecto
- [ ] English (EN)
- [ ] Français (FR)
- [ ] Language switcher en la UI
- [ ] **Todo el texto visible debe ser traducible** — sin strings hardcodeadas

---

### Fase 6 — Pulido y entrega
> **Semana 12** · Módulos: Monitoring (2pts)

#### UI / UX
- [ ] Lobby — lista de salas, crear sala, unirse
- [ ] HUD durante la partida (puntuación, tiempo, items)
- [ ] Pantallas: login, registro, perfil, lobby, resultados
- [ ] Responsive — funciona en distintos tamaños de pantalla
- [ ] Cero errores en consola de Chrome

#### Páginas obligatorias del subject
- [ ] **Privacy Policy** — accesible desde footer, contenido real
- [ ] **Terms of Service** — accesible desde footer, contenido real
- [ ] Ambas páginas en los 3 idiomas

#### Monitoring
- [ ] Prometheus recogiendo métricas de todos los servicios
- [ ] Grafana con dashboard de estado del sistema
- [ ] Alertas básicas configuradas

#### CI/CD y documentación
- [ ] GitHub Actions — lint + build en cada PR
- [ ] `README.md` completo según requisitos del subject
  - Roles del equipo
  - Stack técnico con justificaciones
  - Schema de base de datos
  - Lista de features y módulos
  - Instrucciones para levantar el proyecto
  - Cómo se usó IA en el proyecto
- [ ] `.env.example` actualizado con todas las variables

#### Testing final
- [ ] Playtest con 4 jugadores mínimo
- [ ] Playtest con 8 jugadores
- [ ] `docker compose up --build` desde cero en máquina limpia
- [ ] Revisión de todos los módulos del subject — demo preparada

---

## 🔗 Dependencias críticas

```
Auth service        ← necesario para todo lo demás
       ↓
NATS broker         ← necesario antes de game-service
       ↓
Game service        ← necesario antes de mecánicas
       ↓
Mecánicas           ← necesario antes de módulos
       ↓
User management     ← puede desarrollarse en paralelo desde fase 2
i18n                ← puede añadirse en cualquier momento, mejor antes
OAuth               ← requiere auth service funcionando
```

---

## ⚠️ Riesgos conocidos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Rendimiento 3D con 8 jugadores | Media | Spike en semana 5, instancing para NPCs |
| Sincronización realtime con lag alto | Media | Interpolación + predicción en cliente |
| i18n incompleto en evaluación | Alta | Traducir strings desde el principio, no al final |
| Módulo no funcional en demo | Media | Preparar demo guiada por módulo |
| `docker compose up` falla en máquina limpia | Baja | Testear en máquina limpia antes de entregar |

---

## 📐 Stack definitivo

| Capa | Tecnología |
|------|------------|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| 3D | Three.js + React Three Fiber + Drei |
| Estado | Zustand + React Query |
| Backend | NestJS + TypeScript |
| Realtime | Socket.IO + NATS |
| Base de datos | PostgreSQL + Prisma |
| Auth | JWT + bcrypt + Passport.js |
| Infra | Docker + Docker Compose + Nginx |
| Monitoring | Prometheus + Grafana |
| CI/CD | GitHub Actions |

---

*Última actualización: mayo 2025*
