# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.nest.json ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps/notification-service/package.json ./apps/notification-service/package.json
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.nest.json ./
COPY apps/notification-service ./apps/notification-service
RUN pnpm --filter @whoshuman/shared-events build && pnpm --filter @whoshuman/notification-service build

# ---- runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HUSKY=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps/notification-service/package.json ./apps/notification-service/package.json
RUN pnpm install --prod --frozen-lockfile --ignore-scripts --filter @whoshuman/notification-service
COPY --from=builder /app/packages/shared-events/dist ./packages/shared-events/dist
WORKDIR /app/apps/notification-service
COPY --from=builder /app/apps/notification-service/dist ./dist
CMD ["node", "dist/main.js"]
