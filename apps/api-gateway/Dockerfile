# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.nest.json ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps/api-gateway/package.json ./apps/api-gateway/package.json
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.nest.json ./
COPY apps/api-gateway ./apps/api-gateway
RUN pnpm --filter @whoshuman/shared-events build && pnpm --filter @whoshuman/api-gateway build

# ---- runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HUSKY=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps/api-gateway/package.json ./apps/api-gateway/package.json
RUN pnpm install --prod --frozen-lockfile --ignore-scripts --filter @whoshuman/api-gateway
COPY --from=builder /app/packages/shared-events/dist ./packages/shared-events/dist
WORKDIR /app/apps/api-gateway
COPY --from=builder /app/apps/api-gateway/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
