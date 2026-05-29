# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.nest.json ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps/chat-service/package.json ./apps/chat-service/package.json
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.nest.json ./
COPY apps/chat-service ./apps/chat-service
RUN pnpm --filter @whoshuman/shared-events build && pnpm --filter @whoshuman/chat-service build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HUSKY=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps/chat-service/package.json ./apps/chat-service/package.json
RUN pnpm install --prod --frozen-lockfile --ignore-scripts --filter @whoshuman/chat-service
COPY --from=builder /app/packages/shared-events/dist ./packages/shared-events/dist
WORKDIR /app/apps/chat-service
COPY --from=builder /app/apps/chat-service/dist ./dist
CMD ["node", "dist/main.js"]
