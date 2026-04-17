.PHONY: dev build up down logs migrate seed reset install lint test

# ─── Development ─────────────────────────────────────────────────────────────
dev:
	@echo "Starting backend and frontend in dev mode..."
	@$(MAKE) -j2 dev-backend dev-frontend

dev-backend:
	cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

dev-frontend:
	cd frontend && npm run dev

# ─── Docker ──────────────────────────────────────────────────────────────────
up:
	docker-compose up --build -d

down:
	docker-compose down

logs:
	docker-compose logs -f backend

saas-up:
	docker-compose -f docker-compose.yml -f docker-compose.saas.yml up --build -d

# ─── Database ────────────────────────────────────────────────────────────────
migrate:
	cd backend && alembic upgrade head

migrate-create:
	cd backend && alembic revision --autogenerate -m "$(name)"

seed:
	cd backend && python -m app.seed

reset-db:
	cd backend && alembic downgrade base && alembic upgrade head && python -m app.seed

# ─── Backend ─────────────────────────────────────────────────────────────────
install-backend:
	cd backend && pip install -r requirements.txt

lint-backend:
	cd backend && ruff check app/

test-backend:
	cd backend && pytest tests/ -v

# ─── Frontend ────────────────────────────────────────────────────────────────
install-frontend:
	cd frontend && npm install

lint-frontend:
	cd frontend && npm run lint

build-frontend:
	cd frontend && npm run build

test-frontend:
	cd frontend && npm run test

# ─── Combined ────────────────────────────────────────────────────────────────
install:
	$(MAKE) install-backend
	$(MAKE) install-frontend

lint:
	$(MAKE) lint-backend
	$(MAKE) lint-frontend

test:
	$(MAKE) test-backend
	$(MAKE) test-frontend
