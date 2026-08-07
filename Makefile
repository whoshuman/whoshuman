.PHONY: help all clean fclean re install build certs dev dev-d db down purge logs ps stats images prune shell migrate generate studio reset

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

ps: ## Ver estado de todos los contenedores
	docker compose ps

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
