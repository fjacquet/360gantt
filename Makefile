.PHONY: help install dev build preview typecheck lint lint-fix format test test-ui test-coverage ci docker docker-run release clean

IMAGE ?= 360gantt
VERSION ?= $(shell node -p "require('./package.json').version")

# Default target
help:
	@echo "360gantt - Dell Asset Gantt Visualizer"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "  install        Install dependencies (npm ci)"
	@echo "  dev            Start development server"
	@echo "  build          Production build"
	@echo "  preview        Build then serve locally"
	@echo ""
	@echo "  typecheck      TypeScript type check"
	@echo "  lint           Biome lint"
	@echo "  lint-fix       Biome lint with auto-fix"
	@echo "  format         Biome format"
	@echo ""
	@echo "  test           Run tests (watch mode)"
	@echo "  test-ui        Run tests with UI"
	@echo "  test-coverage  Run tests with coverage report"
	@echo ""
	@echo "  ci             Full CI check (typecheck + lint + test-coverage + build)"
	@echo ""
	@echo "  docker         Build Docker image ($(IMAGE):$(VERSION))"
	@echo "  docker-run     Build and run Docker image on port 8080"
	@echo "  release        Tag and push v$(VERSION) to trigger GitHub Release"
	@echo ""
	@echo "  clean          Remove dist and Vite cache"

# ── Dependencies ──────────────────────────────────────────────────────────────

install:
	npm ci

# ── Development ───────────────────────────────────────────────────────────────

dev:
	npm run dev

preview: build
	npm run preview

# ── Quality ───────────────────────────────────────────────────────────────────

typecheck:
	npm run typecheck

lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

test:
	npm test

test-ui:
	npm run test:ui

test-coverage:
	npm run test:coverage

# ── Build ─────────────────────────────────────────────────────────────────────

build:
	npm run build

# ── CI (mirrors the GitHub Actions check job) ─────────────────────────────────

ci: typecheck lint test-coverage build

# ── Docker ────────────────────────────────────────────────────────────────────

docker:
	docker build -t $(IMAGE):$(VERSION) -t $(IMAGE):latest .

docker-run: docker
	docker run --rm -p 8080:80 $(IMAGE):latest

# ── Release ───────────────────────────────────────────────────────────────────

release:
	@if git rev-parse v$(VERSION) >/dev/null 2>&1; then \
	  echo "Tag v$(VERSION) already exists"; exit 1; \
	fi
	git tag -a v$(VERSION) -m "Release v$(VERSION)"
	git push origin v$(VERSION)
	@echo "Tagged and pushed v$(VERSION) — GitHub Actions will create the release and Docker image."

# ── Housekeeping ──────────────────────────────────────────────────────────────

clean:
	rm -rf dist node_modules/.vite
