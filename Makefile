.PHONY: help install dev build preview typecheck lint lint-fix format test test-ui test-coverage ci clean

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

# ── Housekeeping ──────────────────────────────────────────────────────────────

clean:
	rm -rf dist node_modules/.vite
