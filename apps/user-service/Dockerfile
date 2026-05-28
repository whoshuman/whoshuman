# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/user-service/package*.json ./apps/user-service/
COPY packages/ ./packages/
RUN npm install --frozen-lockfile

# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/user-service ./apps/user-service
RUN npm run build -w apps/user-service

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/user-service/dist ./dist
RUN npm prune --production
EXPOSE 3000
CMD ["node", "dist/main.js"]
