.PHONY: help install dev build typecheck lint lint-fix format test clean

# Default target
help:
	@echo "360gantt - Dell Asset Gantt Visualizer"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  install    Install dependencies"
	@echo "  dev        Start development server"
	@echo "  build      Build for production"
	@echo "  typecheck  Run TypeScript type checking"
	@echo "  lint       Run Biome linter"
	@echo "  lint-fix   Run Biome linter with auto-fix"
	@echo "  format     Format code with Biome"
	@echo "  test       Run tests"
	@echo "  clean      Remove build artifacts"
	@echo "  all        Run lint, typecheck, and build"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

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

clean:
	rm -rf dist
	rm -rf node_modules/.vite

all: lint typecheck build
