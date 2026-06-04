# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.nest.json ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps/auth-service/package.json ./apps/auth-service/package.json
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.nest.json ./
COPY apps/auth-service ./apps/auth-service
RUN pnpm --filter @whoshuman/shared-events build && pnpm --filter @whoshuman/shared-types build && pnpm --filter @whoshuman/auth-service build

# ---- runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HUSKY=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps/auth-service/package.json ./apps/auth-service/package.json
RUN pnpm install --prod --frozen-lockfile --ignore-scripts --filter @whoshuman/auth-service
COPY --from=builder /app/packages/shared-events/dist ./packages/shared-events/dist
WORKDIR /app/apps/auth-service
COPY --from=builder /app/apps/auth-service/dist ./dist
CMD ["node", "dist/main.js"]
