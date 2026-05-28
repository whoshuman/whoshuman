# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/ ./packages/
RUN npm install --frozen-lockfile

# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/frontend ./apps/frontend
# TODO (task: frontend-setup): añadir ARGs para variables de Vite
# Las variables VITE_* se incrustan en build time, no en runtime.
# Ejemplo:
#   ARG VITE_API_URL
#   ARG VITE_WS_URL
#   ENV VITE_API_URL=$VITE_API_URL
#   ENV VITE_WS_URL=$VITE_WS_URL
WORKDIR /app/apps/frontend
RUN npm run build

# ---- serve ----
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
# TODO (task: frontend-setup): crear apps/frontend/nginx.conf con try_files
# para que React Router funcione correctamente en la SPA.
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
