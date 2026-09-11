.PHONY: help all clean fclean re install build certs dev dev-d db down purge logs ps stats images prune shell migrate generate studio reset tunnel tunnel-stop

.DEFAULT_GOAL := all

# ─── Colors ───────────────────────────────────────────────────────────────────
CYAN  = \033[0;36m
RESET = \033[0m

# ─── Help ─────────────────────────────────────────────────────────────────────

help: ## Muestra esta ayuda
	@echo ""
	@echo "  Who's Human — comandos disponibles"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-15s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# ─── 42 Classics ──────────────────────────────────────────────────────────────

all: install certs dev ## Instala, genera certs y levanta todo (default)

clean: ## Borra los dist/ de todos los servicios
	rm -rf apps/*/dist packages/*/dist

fclean: down clean ## Para Docker, borra dist/ y node_modules
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	docker compose down -v --remove-orphans

re: fclean all ## Limpia todo y vuelve a construir desde cero

# ─── Setup ────────────────────────────────────────────────────────────────────

install: ## Instala dependencias
	pnpm install

build: ## Compila paquetes y servicios (genera el cliente Prisma antes)
	pnpm db:generate
	pnpm build

certs: ## Genera certificados SSL self-signed para desarrollo
	./infrastructure/scripts/generate-certs.sh

# ─── Docker ───────────────────────────────────────────────────────────────────

dev: ## Levanta todos los servicios
	docker compose up --build

dev-d: ## Levanta todos los servicios en background
	docker compose up --build -d

db: ## Levanta solo PostgreSQL y NATS (para migraciones locales)
	docker compose up -d postgres nats

down: ## Para todos los servicios
	docker compose down

purge: ## Para todos los servicios y borra los volúmenes (⚠️ borra la BD)
	docker compose down -v

logs: ## Ver logs de todos los servicios (o de uno: make logs s=auth-service)
	docker compose logs -f $(s)

ps:
	@C_RED=$$(printf '\033[1;31m'); \
	C_YELLOW=$$(printf '\033[1;33m'); \
	C_GREEN=$$(printf '\033[1;32m'); \
	C_BLUE=$$(printf '\033[1;34m'); \
	C_RESET=$$(printf '\033[0m'); \
	docker compose ps --format "table $${C_RED}{{.Name}}$${C_RESET}\t$${C_YELLOW}{{.Service}}$${C_RESET}\t$${C_GREEN}{{.Status}}$${C_RESET}\t$${C_BLUE}{{.Ports}}$${C_RESET}"
stats: ## Ver uso de CPU y memoria de los contenedores
	docker stats

images: ## Listar imágenes del proyecto
	docker compose images

prune: ## Limpiar imágenes y caché de Docker sin usar
	docker system prune -f

shell: ## Entrar en la shell de un contenedor (uso: make shell s=auth-service)
	docker compose exec $(s) sh

# ─── Base de datos ────────────────────────────────────────────────────────────

migrate: ## Ejecuta las migraciones pendientes dentro de Docker
	docker compose run --rm migrate

generate: ## Genera el cliente de Prisma
	pnpm db:generate

studio: ## Abre Prisma Studio en el navegador (requiere BD corriendo)
	pnpm db:studio

reset: ## Resetea la BD completamente (⚠️ borra todos los datos)
	pnpm db:reset

# ─── Túnel público ────────────────────────────────────────────────────────────

tunnel: ## Levanta todo y expone una URL pública temporal (Cloudflare Tunnel)
	@CF="$$(command -v cloudflared || true)"; \
	if [ -z "$$CF" ] && [ -x "$(HOME)/.local/bin/cloudflared" ]; then \
		CF="$(HOME)/.local/bin/cloudflared"; \
	fi; \
	if [ -z "$$CF" ]; then \
		echo "cloudflared no encontrado: instalando sin sudo en $(HOME)/.local/bin ..."; \
		mkdir -p "$(HOME)/.local/bin"; \
		case "$$(uname -m)" in \
			x86_64|amd64) asset=cloudflared-linux-amd64 ;; \
			aarch64|arm64) asset=cloudflared-linux-arm64 ;; \
			*) echo "Arquitectura $$(uname -m) no soportada por el instalador automatico. Instala a mano: https://pkg.cloudflare.com/"; exit 1 ;; \
		esac; \
		curl -fLo "$(HOME)/.local/bin/cloudflared" "https://github.com/cloudflare/cloudflared/releases/latest/download/$$asset" || { echo "Descarga fallida"; exit 1; }; \
		chmod +x "$(HOME)/.local/bin/cloudflared"; \
		CF="$(HOME)/.local/bin/cloudflared"; \
	fi; \
	docker compose up --build -d; \
	nohup "$$CF" tunnel --url https://localhost:4433 --no-tls-verify > /tmp/whoshuman-tunnel.log 2>&1 & \
	echo $$! > /tmp/whoshuman-tunnel.pid
	@sleep 6
	@grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/whoshuman-tunnel.log | head -1

tunnel-stop: ## Detiene el túnel público
	@[ -f /tmp/whoshuman-tunnel.pid ] && kill $$(cat /tmp/whoshuman-tunnel.pid) && rm /tmp/whoshuman-tunnel.pid || echo "no hay túnel activo"
