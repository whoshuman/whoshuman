_This project has been created as part of the 42 curriculum by jdelorme, smarin-a, zlu, descamil, ldiaz-ra._

# Who's Human

## Description

**Who's Human** is a real-time multiplayer social-stealth game played in the browser, inspired by
_Just Act Natural_. A group of players is dropped into a 3D cyberpunk city populated by NPCs. One
player is the **Hunter**: they observe the city from an aerial gunship and shoot whoever they think
is not an NPC. Everybody else plays as a **Cyborg**: they must blend into the crowd, move like an
NPC and collect data cells without giving themselves away.

A match is three rounds of 90 seconds. Roles rotate between rounds, and the player with the highest
score at the end wins. Hitting a hidden player scores +100, collecting a data cell +25, and shooting
an innocent NPC costs the Hunter −25. A round ends when the timer runs out or when the Hunter has
found every Cyborg.

The game is only the visible half of the project. Underneath it there is a full web platform:
account system with OAuth, friends and presence, private and group chat, notifications, match
history and statistics — all served by eight independent backend services communicating over NATS.

### Key features

- Authoritative real-time 3D multiplayer for up to 8 players per lobby (server-side simulation,
  clients only render snapshots).
- 3D city rendered in the browser with Three.js / react-three-fiber, animated characters, NPC crowd
  simulation, aiming laser and gunship camera.
- Email + password accounts (bcrypt) plus OAuth 2.0 sign-in with Google and 42.
- Friends system with requests, blocking, live online presence and real-time notifications.
- Private (1-to-1) and group (lobby / in-game) chat with persistent history.
- Profile with avatar, bio, language, combat statistics and match history.
- Full UI in English, Spanish and French with a live language switcher.
- Mobile support: dual virtual joysticks, fullscreen and landscape lock.
- HTTPS everywhere, rate limiting, and validation on both the client and the server.

---

## Instructions

### Prerequisites

| Tool    | Version    | Notes                                             |
| ------- | ---------- | ------------------------------------------------- |
| Docker  | 24+        | With the Compose v2 plugin (`docker compose`)     |
| Node.js | >= 22.13.0 | Only needed on the host for Prisma and tooling    |
| pnpm    | >= 11.1.1  | `corepack enable` is enough on Node 22            |
| make    | any        | Used as the entry point for every command         |
| openssl | any        | Used by `make certs` for the self-signed SSL cert |

### Running the project

```bash
# 1. Clone the repository
git clone https://github.com/whoshuman/whoshuman.git
cd whoshuman

# 2. Install dependencies
pnpm install

# 3. Generate the local SSL certificate (only the first time)
make certs

# 4. Copy the environment files and edit the values you need
cp .env.example .env
cp infrastructure/postgres/.env.example infrastructure/postgres/.env
cp apps/api-gateway/.env.example apps/api-gateway/.env
cp apps/realtime-gateway/.env.example apps/realtime-gateway/.env
cp apps/auth-service/.env.example apps/auth-service/.env
cp apps/user-service/.env.example apps/user-service/.env
cp apps/game-service/.env.example apps/game-service/.env
cp apps/matchmaking-service/.env.example apps/matchmaking-service/.env
cp apps/chat-service/.env.example apps/chat-service/.env
cp apps/notification-service/.env.example apps/notification-service/.env

# 5. Bring the whole stack up with a single command (migrations run automatically)
make dev
```

Then open **https://localhost** in Google Chrome. The certificate is self-signed, so the browser
will show a warning the first time — accept it to continue.

> **Environment variables.** No `.env` file is committed: every one of them is ignored by Git and
> shipped as a `.env.example` next to the service that reads it. The variables that must be set
> before a real deployment are `JWT_SECRET`, `JWT_REFRESH_SECRET`, the PostgreSQL credentials and
> the OAuth client id/secret pairs for Google and 42.

> **SSL certificate.** `make certs` generates a self-signed certificate for local development into
> `infrastructure/nginx/certs/`. It is not committed — every developer generates their own.

### Commands

#### Setup

| Command        | Description                                        |
| -------------- | -------------------------------------------------- |
| `make all`     | Install, generate certificates and start the stack |
| `make install` | Install dependencies                               |
| `make certs`   | Generate the self-signed SSL certificate           |
| `make build`   | Compile every package and service                  |
| `make re`      | Wipe everything and rebuild from scratch           |

#### Docker

| Command                     | Description                           |
| --------------------------- | ------------------------------------- |
| `make dev`                  | Start every service                   |
| `make dev-d`                | Start every service in the background |
| `make db`                   | Start only PostgreSQL and NATS        |
| `make down`                 | Stop every service                    |
| `make purge`                | Stop services and delete volumes ⚠️   |
| `make ps`                   | Show container status                 |
| `make stats`                | Live CPU and memory usage             |
| `make logs`                 | Follow the logs of every service      |
| `make logs s=auth-service`  | Follow the logs of one service        |
| `make shell s=auth-service` | Open a shell inside a container       |
| `make prune`                | Clean unused images and build cache   |

#### Database

| Command         | Description                        |
| --------------- | ---------------------------------- |
| `make migrate`  | Apply pending migrations in Docker |
| `make generate` | Generate the Prisma client         |
| `make studio`   | Open Prisma Studio in the browser  |
| `make reset`    | Reset the database completely ⚠️   |

#### Quality

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `pnpm lint`         | Run ESLint across the workspace      |
| `pnpm format:check` | Check formatting with Prettier       |
| `pnpm test`         | Run the unit test suites             |
| `pnpm build`        | Type-check and build every workspace |

> **`DATABASE_URL` depends on where the command runs.** Services and migrations run inside Docker
> and use `postgres:5432`; Prisma Studio runs on the host and uses `localhost:5432`.

### Troubleshooting

**`pnpm install` hangs on Apple Silicon.**

```bash
pkill -f "pnpm install" 2>/dev/null || true
rm -rf node_modules
pnpm store prune
pnpm install
```

**PostgreSQL refuses connections from the host.** Make sure the container is up and healthy, and
that your host `.env` points at `localhost` rather than `postgres`:

```bash
make db
make ps
```

---

## Team Information

| Member          | 42 login   | Role(s)                     | Responsibilities                                                                                               |
| --------------- | ---------- | --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Edu Zhan        | `zlu`      | Product Owner · Developer   | Product vision and backlog, feature prioritisation, validation of finished work, backend and frontend features |
| Juan Delorme    | `jdelorme` | Project Manager · Developer | Meeting and sprint organisation, progress and deadline tracking, frontend implementation                       |
| Luis David Diaz | `ldiaz-ra` | Technical Lead · Developer  | Technical architecture, stack decisions, code review of critical changes, CI/CD, real-time gameplay            |
| Sergio Marin    | `smarin-a` | Developer                   | Design system, 3D home scene, visual identity and Tailwind migration                                           |
| Daniel Escamil  | `descamil` | Developer                   | 3D assets: city map, character models and animations                                                           |

## Project Management

**How the work was organised.** The project was split into two tracks that could advance in
parallel — the platform (auth, users, friends, chat, notifications) and the game (matchmaking,
authoritative simulation, 3D rendering) — with a shared contract layer (`packages/shared-*`) agreed
up front so both tracks could move without blocking each other. Work was broken down into small
features, each one living in its own branch named after the GitHub issue it closed
(`78-featfriends`, `85-featpersonajes-finales`, …).

**Tools used.**

- **GitHub Issues** for the backlog: every feature and bug is an issue, and every branch is named
  after its issue number.
- **GitHub Pull Requests** for code review: no branch reaches `develop` without at least one
  review from another member.
- **GitHub Actions** for continuous deployment to the staging VPS on every push to `develop`.
- **Husky + lint-staged** so ESLint and Prettier run before every commit and the pre-push hook
  builds the shared packages.

**Communication.** Day-to-day coordination happened on **Discord**, with weekly in-person syncs at
the campus to review progress and re-prioritise the backlog.

**Branching model.** Documented in [`docs/GITFLOW.md`](docs/GITFLOW.md): feature branches off
`develop`, `develop` as the integration branch, `main` as the stable branch.

---

## Technical Stack

### Frontend

| Technology                       | Why                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **React 19**                     | Team familiarity and the largest ecosystem for the 3D and state libraries we needed                            |
| **TanStack Router**              | Fully type-safe routing; a wrong route is a compile error rather than a 404 in production                      |
| **TanStack Query**               | Server-state caching, retries and invalidation without hand-writing a fetch layer                              |
| **Zustand**                      | Tiny, hook-based global state; the game loop mutates a store 60 times a second and Redux was too much ceremony |
| **Three.js + react-three-fiber** | 3D city and characters rendered declaratively as React components instead of imperative scene graph code       |
| **Tailwind CSS v4**              | Our styling solution; the retrowave design system is built from Tailwind tokens (see `/design-system`)         |
| **socket.io-client**             | WebSocket transport with automatic reconnection, which the game loop depends on                                |
| **i18next / react-i18next**      | Internationalisation in English, Spanish and French                                                            |
| **Vite**                         | Build tool and dev server                                                                                      |

### Backend

| Technology                | Why                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NestJS**                | Opinionated modular architecture with first-class microservice transports, DI and validation pipes                                                                  |
| **NATS**                  | Lightweight message broker for service-to-service communication; request/reply and pub/sub in one broker                                                            |
| **socket.io**             | Real-time transport between the browser and the realtime gateway                                                                                                    |
| **Prisma**                | Our ORM: typed client generated from the schema, plus versioned migrations                                                                                          |
| **bcrypt**                | Password hashing with per-password salt and 10 rounds                                                                                                               |
| **@nestjs/jwt**           | Short-lived access tokens and rotating refresh tokens signed with two different secrets                                                                             |
| **class-validator / Joi** | DTO validation on every service and environment-variable validation at boot                                                                                         |
| **Nginx**                 | TLS termination, HTTP→HTTPS redirect, reverse proxy and WebSocket upgrade                                                                                           |
| **PostgreSQL**            | Relational data with real foreign keys — friendships, sessions and scores are all relationships, and we need transactional integrity when a match result is written |

### Justification for the major technical choices

**Why microservices instead of a monolith?** The game loop is CPU-bound and runs at a fixed tick
rate; the REST API is I/O-bound and bursty. Isolating them means a heavy match cannot starve the
login endpoint, and the game service can be scaled or restarted on its own. It also let the two
work tracks own separate deployables.

**Why NATS instead of HTTP between services?** Most inter-service traffic is fire-and-forget events
(`player.moved`, `notification.send`). NATS gives us pub/sub and request/reply over one connection,
with no service discovery to maintain.

**Why an authoritative server?** In a hiding game, any client-side authority is an instant cheat:
a modified client could reveal every hidden player. The server owns the entire world state and
clients only send inputs and render the snapshots they receive.

---

## Database Schema

PostgreSQL, managed with Prisma. The full definition lives in
[`prisma/schema.prisma`](prisma/schema.prisma).

```
                            ┌───────────────┐
                            │     User      │
                            │───────────────│
                            │ id (uuid) PK  │
                            │ email    UQ   │
                            │ username UQ   │
                            │ password      │  bcrypt hash
                            │ avatar        │
                            │ bio           │
                            │ language      │
                            │ deletedAt     │  soft delete
                            └───────┬───────┘
                                    │
    ┌──────────────┬────────────────┼──────────────┬─────────────────┐
    │              │                │              │                 │
┌───▼─────┐  ┌─────▼────────┐  ┌────▼────────┐ ┌───▼──────────┐ ┌────▼─────────┐
│ Session │  │ OAuthAccount │  │ Friendship  │ │ Notification │ │ ChatMessage  │
│─────────│  │──────────────│  │─────────────│ │──────────────│ │──────────────│
│ id PK   │  │ id PK        │  │ id PK       │ │ id PK        │ │ id PK        │
│ userId  │  │ provider     │  │ requesterId │ │ recipientId  │ │ scope        │
│ refresh │  │ providerAcId │  │ addresseeId │ │ type         │ │ channelId    │
│  Token  │  │ userId       │  │ status      │ │ actorId      │ │ senderId     │
│ expires │  │              │  │             │ │ data (json)  │ │ recipientId  │
│  At     │  │ UQ(provider, │  │ UQ(requester│ │ readAt       │ │ content      │
└─────────┘  │  providerAcId)│ │  ,addressee)│ └──────────────┘ └──────────────┘
             └──────────────┘  └─────────────┘

                            ┌───────────────┐
                            │     Game      │
                            │───────────────│
                            │ id PK         │
                            │ status        │  WAITING | PLAYING | ENDED
                            └───┬───────┬───┘
                                │       │
                      ┌─────────▼──┐ ┌──▼───────────────┐
                      │   Round    │ │      Score       │
                      │────────────│ │──────────────────│
                      │ id PK      │ │ id PK            │
                      │ gameId FK  │ │ userId FK ───────┼──► User
                      │ number     │ │ gameId FK        │
                      │ status     │ │ points           │
                      │ timeLimit  │ │ UQ(userId,gameId)│
                      │ startedAt  │ └──────────────────┘
                      │ endedAt    │
                      └────────────┘
```

### Tables and relationships

| Table            | Purpose                     | Key fields                                                                                                          | Relationships                                                               |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `users`          | Accounts and profiles       | `id` uuid PK, `email` unique, `username` unique, `password` (bcrypt hash), `avatar`, `bio`, `language`, `deletedAt` | Root of every other relationship                                            |
| `sessions`       | Active refresh tokens       | `refreshToken` unique, `expiresAt`                                                                                  | N:1 `users`, cascade delete                                                 |
| `oauth_accounts` | Linked Google / 42 accounts | `provider` + `providerAccountId` unique together                                                                    | N:1 `users`, cascade delete                                                 |
| `friendships`    | Friend graph and blocks     | `status` (PENDING / ACCEPTED / BLOCKED), unique on (`requesterId`, `addresseeId`)                                   | N:1 `users` twice (requester and addressee)                                 |
| `notifications`  | Social notification feed    | `type`, `actorId`, `data` json, `readAt`, indexed on (`recipientId`, `createdAt`)                                   | N:1 `users`                                                                 |
| `chat_messages`  | Chat history                | `scope` (DIRECT / LOBBY / GAME), `channelId`, `content`, indexed on (`scope`, `channelId`, `createdAt`)             | N:1 `users` as sender, optional N:1 as recipient                            |
| `games`          | Finished matches            | `status` (WAITING / PLAYING / ENDED)                                                                                | 1:N `rounds`, 1:N `scores`                                                  |
| `rounds`         | Per-round record of a match | `number`, `status`, `timeLimit`, `startedAt`, `endedAt`                                                             | N:1 `games`, cascade delete                                                 |
| `scores`         | Final score per player      | `points`, unique on (`userId`, `gameId`)                                                                            | N:1 `users`, N:1 `games` — this is what drives statistics and match history |

Deleting an account is a **soft delete** (`deletedAt`): the row is anonymised and kept so that past
matches, scores and chat history stay consistent instead of leaving dangling references.

---

## Architecture

```
                             Browser (Chrome)
                                    │ HTTPS / WSS
                            ┌───────▼────────┐
                            │     Nginx      │  TLS, HTTP→HTTPS, reverse proxy
                            └───┬────────┬───┘
                     /          │        │  /api        /socket.io
              ┌─────────────┐   │   ┌────▼─────────┐  ┌──────────────────┐
              │  frontend   │◄──┘   │ api-gateway  │  │ realtime-gateway │
              │ (React SPA) │       │ REST + JWT   │  │  Socket.IO       │
              └─────────────┘       │ rate limit   │  │                  │
                                    └──────┬───────┘  └────────┬─────────┘
                                           │                   │
                                    ┌──────▼───────────────────▼──────┐
                                    │              NATS               │
                                    └──┬────┬────┬─────┬────┬─────────┘
                                       │    │    │     │    │
              ┌────────────────────────┘    │    │     │    └──────────────────┐
              │              ┌──────────────┘    │     └──────────┐            │
        ┌─────▼──────┐ ┌─────▼──────┐ ┌──────────▼───┐ ┌──────────▼──┐ ┌───────▼────────┐
        │   auth     │ │   user     │ │     game     │ │ matchmaking │ │ chat +         │
        │  service   │ │  service   │ │   service    │ │   service   │ │ notification   │
        └─────┬──────┘ └─────┬──────┘ └──────┬───────┘ └─────────────┘ └───────┬────────┘
              └──────────────┴───────────────┴─────────────────────────────────┘
                                             │
                                      ┌──────▼──────┐
                                      │ PostgreSQL  │
                                      └─────────────┘
```

Longer write-ups live in [`docs/arquitectura.md`](docs/arquitectura.md),
[`docs/Game.md`](docs/Game.md) and [`docs/Matchmaking.md`](docs/Matchmaking.md).

---

## Features List

| Feature                      | Description                                                                                                                 | Built by           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Sign-up and login            | Email + password, bcrypt hashing, JWT access token plus rotating refresh token in a `sessions` table                        | ldiaz-ra, zlu      |
| OAuth 2.0                    | Sign in with Google and 42, account linking through `oauth_accounts`, dedicated callback route                              | zlu                |
| Profile                      | Public profile page, editable username, bio, avatar and language, account deletion (soft delete)                            | zlu, jdelorme      |
| Friends                      | Search users, send and answer requests, remove friends, block and unblock                                                   | zlu, jdelorme      |
| Presence                     | Live online/offline status of your friends, driven by the realtime gateway                                                  | ldiaz-ra, jdelorme |
| Notifications                | Persistent notification feed plus real-time toasts, unread counter, mark one/all as read                                    | zlu, jdelorme      |
| Private chat                 | 1-to-1 conversations with persistent history, opened from the friends list                                                  | zlu                |
| Group chat                   | Lobby and in-game channels with unread badges                                                                               | zlu                |
| Lobby and matchmaking        | Room codes, ready state, 2–8 player lobbies, role assignment before the match starts                                        | ldiaz-ra, jdelorme |
| Authoritative game loop      | Server-side simulation: rounds, timers, NPC crowd, collectibles, hit detection, scoring, reconnection                       | ldiaz-ra, zlu      |
| 3D game view                 | City rendering, animated characters, gunship camera, aiming laser, snapshot interpolation                                   | jdelorme, ldiaz-ra |
| 3D assets                    | City map, character and vehicle models, animation frames                                                                    | descamil, jdelorme |
| Home 3D scene                | Retrowave landing scene: sun, mountains, road, traffic and DeLorean                                                         | smarin-a           |
| Design system                | Retrowave palette, typography and reusable components, browsable at `/design-system`                                        | smarin-a           |
| Mobile controls              | Dual virtual joysticks, fullscreen, landscape lock, touch-aware input pipeline                                              | ldiaz-ra           |
| Statistics and match history | Wins/losses, exponential level progression, achievements, global rank, top-10 leaderboard and recent matches with opponents | zlu                |
| Internationalisation         | English, Spanish and French, switcher in the UI, language persisted on the profile                                          | zlu, jdelorme      |
| Sound design                 | Weapon, data-cell, match start and match end effects, plus UI sounds                                                        | jdelorme           |
| Legal pages                  | Privacy Policy and Terms of Service, translated, reachable from the footer and the home menu                                | zlu                |
| System status page           | `/status` health view of every backend service                                                                              | jdelorme           |
| Infrastructure               | Docker Compose stack, Nginx with TLS, NATS, staging deployment via GitHub Actions                                           | ldiaz-ra, zlu      |

---

## Modules

**Total claimed: 22 points** (14 required + 8 beyond, of which the bonus is capped at 5).

### Web

| Module                                 | Type  | Points | How it was implemented                                                                                                                                                          | By                 |
| -------------------------------------- | ----- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Framework for frontend **and** backend | Major |      2 | React 19 on the frontend, NestJS on all eight backend services                                                                                                                  | everyone           |
| Real-time features via WebSockets      | Major |      2 | `realtime-gateway` with Socket.IO: JWT-authenticated connections, rooms per lobby/game/user, snapshot broadcasting at a fixed tick, graceful disconnect and reconnection timers | ldiaz-ra, jdelorme |
| User interaction                       | Major |      2 | Basic chat (private + group, persisted in `chat_messages`), profile system (`/profile`, public profiles by id) and friends system (requests, list, removal, blocking)           | zlu, jdelorme      |
| ORM                                    | Minor |      1 | Prisma with a versioned migration history and a generated typed client shared by every service that touches the database                                                        | ldiaz-ra           |

### Accessibility and Internationalization

| Module             | Type  | Points | How it was implemented                                                                                                                                                                                                                                                                                                   | By            |
| ------------------ | ----- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| Multiple languages | Minor |      1 | i18next with three complete translations (English, Spanish, French — 349 keys each), a switcher in the settings menu, and the choice persisted on the user profile so it follows the account across devices. Every user-facing string goes through `t()`; backend validation errors are translated too via `nestjs-i18n` | zlu, jdelorme |

### User Management

| Module                            | Type  | Points | How it was implemented                                                                                                                                                                                    | By            |
| --------------------------------- | ----- | -----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Standard user management          | Major |      2 | Users update their profile (username, bio, language), upload an avatar with a generated fallback, add friends and see their live online status, and every user has a profile page                         | zlu, jdelorme |
| Game statistics and history       | Minor |      1 | `GET /api/users/me/stats` derives wins/losses, exponential XP levels, four achievements, global rank, a top-10 leaderboard and the five latest matches with placement and opponents from persisted scores | zlu           |
| Remote authentication (OAuth 2.0) | Minor |      1 | Full OAuth 2.0 authorization-code flow against Google and 42, with state validation, account linking in `oauth_accounts` and a dedicated `/oauth/callback` route on the frontend                          | zlu           |

### Gaming and user experience

| Module                  | Type  | Points | How it was implemented                                                                                                                                                                                                                        | By                           |
| ----------------------- | ----- | -----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Complete web-based game | Major |      2 | Who's Human: three rounds of 90 seconds, two roles that rotate between rounds, explicit scoring rules (+100 hitting a Cyborg, +25 per data cell, −25 for shooting an NPC) and a clear win condition. Fully server-simulated in `game-service` | ldiaz-ra, zlu                |
| Remote players          | Major |      2 | Players on different machines share the same match in real time. Latency is hidden with client-side snapshot interpolation; disconnections keep the player's slot alive on a reconnect timer instead of dropping them                         | ldiaz-ra, jdelorme           |
| Multiplayer (3+)        | Major |      2 | Lobbies hold up to 8 players (`MATCHMAKING_MAX_PLAYERS`). One Hunter and N Cyborgs, roles rotate each round so the mechanics stay fair, and every client is synchronised from the same authoritative snapshot                                 | ldiaz-ra                     |
| Advanced 3D graphics    | Major |      2 | Three.js through react-three-fiber: full 3D city, animated character meshes with morph-target blending, NPC crowd, aiming laser and visor, postprocessing, and adaptive DPR plus a performance monitor to keep the framerate stable           | jdelorme, descamil, ldiaz-ra |

### Devops

| Module                   | Type  | Points | How it was implemented                                                                                                                                                                                                                                                                                                                                    | By       |
| ------------------------ | ----- | -----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Backend as microservices | Major |      2 | Eight loosely-coupled services, each with a single responsibility and its own Dockerfile, `.env` and deployable: `api-gateway`, `realtime-gateway`, `auth`, `user`, `game`, `matchmaking`, `chat`, `notification`. They never call each other directly — all communication goes through NATS with typed subjects defined once in `packages/shared-events` | ldiaz-ra |

### Point calculation

| Category                               | Major     | Minor | Points |
| -------------------------------------- | --------- | ----- | -----: |
| Web                                    | 3 × 2 = 6 | 1 × 1 |      7 |
| Accessibility and Internationalization | —         | 1 × 1 |      1 |
| User Management                        | 1 × 2 = 2 | 2 × 1 |      4 |
| Gaming and user experience             | 4 × 2 = 8 | —     |      8 |
| Devops                                 | 1 × 2 = 2 | —     |      2 |
| **Total**                              |           |       | **22** |

---

## Individual Contributions

### Edu Zhan — `zlu` (Product Owner, Developer)

Owned the product direction and the whole social platform. Implemented the authentication flow
end to end (registration, login, JWT with refresh-token rotation, logout), the complete OAuth 2.0
integration with Google and 42, the friends system (requests, responses, removal, blocking) with its
notification pipeline, the private and group chat across both the frontend and `chat-service`, the
profile and profile-editing screens, statistics and match history, the account-deletion flow with
soft delete, and the Privacy Policy and Terms of Service pages in three languages. Also wrote most
of the documentation under `docs/`.

**Main challenge.** Keeping chat, notifications and presence consistent when a user has several
tabs open. The fix was to give every user a personal Socket.IO room joined at connection time
rather than at page level, so every session of the same account receives the same events.

### Juan Delorme — `jdelorme` (Project Manager, Developer)

Ran the planning and drove most of the frontend. Built the 3D game view on top of the authoritative
loop, real-time notification toasts, the friends UI, the lobby over Socket.IO matchmaking, the
`/status` page, user search with pagination, character and gunship animations, the aiming visor with
its telemetry, and the whole sound design. Also did the 3D asset optimisation work.

**Main challenge.** The original city model weighed 98 MB, which made the game unusable on a normal
connection. Re-exporting and simplifying the geometry brought it down to 17.5 MB without a visible
loss of quality.

### Luis David Diaz — `ldiaz-ra` (Technical Lead, Developer)

Defined the architecture and built the real-time backbone. Implemented the NATS transport layer and
the shared event contracts, the `realtime-gateway` with its authentication and room management, the
matchmaking service, the authoritative game simulation (NPC crowd, scoped combat, line-of-sight
checks, round lifecycle), the Nginx configuration with dynamic Docker upstream resolution, the
GitHub Actions staging deployment, and the mobile touch controls.

**Main challenge.** Players could shoot through buildings, because hit detection ran on a flat
distance check. Solving it meant adding a server-side line-of-sight test against the map geometry
and refreshing the raycast bounds on the client before every shot.

### Sergio Marin — `smarin-a` (Developer)

Defined the visual identity of the project. Built the retrowave 3D home scene from scratch (sun,
horizon, mountains, road, traffic) and split it into composable components, then designed and
implemented the whole design system — palette, typography, badges, panels, forms and buttons —
and led the migration of every screen to Tailwind CSS.

**Main challenge.** The first version of the design system used plain CSS and drifted out of sync
with the components that consumed it. Migrating it to Tailwind tokens made the reference page at
`/design-system` the single source of truth.

### Daniel Escamil — `descamil` (Developer)

Produced the 3D assets the game is built on: the city map, the character models with their
animation frames, the data-cell and the gunship. Also delivered the first playable map demo that
proved the rendering approach was viable.

**Main challenge.** Getting Blender exports into a format the browser could load at an acceptable
size, which required several rounds of re-modelling and re-exporting the city.

---

## Resources

### Documentation and references

- [NestJS documentation](https://docs.nestjs.com/) — microservices, custom transports and validation pipes
- [NestJS microservices with NATS](https://docs.nestjs.com/microservices/nats)
- [NATS documentation](https://docs.nats.io/) — publish/subscribe and request/reply patterns
- [Prisma documentation](https://www.prisma.io/docs) — schema modelling, relations and migrations
- [React documentation](https://react.dev/) — in particular _You Might Not Need an Effect_
- [react-three-fiber documentation](https://r3f.docs.pmnd.rs/) and [drei](https://drei.docs.pmnd.rs/)
- [Three.js manual](https://threejs.org/manual/) — geometry, materials and morph targets
- [Socket.IO documentation](https://socket.io/docs/v4/) — rooms, acknowledgements and reconnection
- [Gabriel Gambetta, _Fast-Paced Multiplayer_](https://www.gabrielgambetta.com/client-server-game-architecture.html) — the reference for our authoritative server and client-side interpolation
- [Valve, _Source Multiplayer Networking_](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking) — entity interpolation and lag compensation
- [OAuth 2.0 Authorization Code Flow (RFC 6749)](https://datatracker.ietf.org/doc/html/rfc6749)
- [42 API documentation](https://api.intra.42.fr/apidoc) and [Google Identity](https://developers.google.com/identity/protocols/oauth2)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) — password storage and JWT handling
- [Tailwind CSS documentation](https://tailwindcss.com/docs)
- [i18next documentation](https://www.i18next.com/)
- [Nginx documentation](https://nginx.org/en/docs/) — TLS termination and WebSocket proxying
- _Just Act Natural_ (Snap Finger Click) — the game that inspired the core mechanic

### Use of AI

AI assistants (ChatGPT and Claude) were used as a support tool, never as a replacement for
understanding. Concretely:

- **Boilerplate and repetitive code.** Generating the initial NestJS module/controller/service
  scaffolding for each microservice and the Docker Compose skeleton, all of it reviewed and adapted
  by hand afterwards.
- **Documentation and comments.** Drafting parts of this README and the documents under `docs/`,
  and reviewing the wording of the Privacy Policy and Terms of Service.
- **Translations.** First-pass English and French translations of the interface strings, reviewed
  and corrected by the team.
- **Debugging support.** Explaining error messages and suggesting hypotheses for specific bugs
  (Prisma cascade behaviour, Socket.IO reconnection, TypeScript type errors), always verified
  against the actual behaviour of the code.
- **Learning.** Explanations of concepts that were new to us — authoritative game loops, snapshot
  interpolation, the OAuth 2.0 authorization-code flow, NATS subject design.

Not written by AI: the game design and its rules, the microservice architecture and its event
contracts, the authoritative simulation, the 3D assets and scenes, and the design system. Every
generated fragment that made it into the repository was read, understood and modified by the person
who committed it, and every member can explain the code they contributed.

---

## Known Limitations

- The SSL certificate is self-signed, so browsers show a warning on first load in local development.
- The game has a single map (`beta-city`); there is no map selection yet.
- The 3D scene is demanding: low-end mobile devices drop framerate even with adaptive DPR enabled.
- There is no tournament or spectator mode.

## Credits

3D models, animations and sound design produced by the team. Game concept inspired by
_Just Act Natural_ by Snap Finger Click.

## License

Academic project developed as part of the 42 curriculum. Not intended for commercial use.
