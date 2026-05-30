# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/notification-service/package*.json ./apps/notification-service/
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile --shamefully-hoist

# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/notification-service ./apps/notification-service
RUN pnpm --filter ./apps/notification-service build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/notification-service/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
