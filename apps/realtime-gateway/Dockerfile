# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/realtime-gateway/package*.json ./apps/realtime-gateway/
COPY packages/ ./packages/
RUN npm install --frozen-lockfile

# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/realtime-gateway ./apps/realtime-gateway
RUN npm run build -w apps/realtime-gateway

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/realtime-gateway/dist ./dist
RUN npm prune --production
EXPOSE 3000
CMD ["node", "dist/main.js"]
