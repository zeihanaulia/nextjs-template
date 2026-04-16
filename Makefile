.PHONY: build proto typecheck install-hooks

build:
	yarn export

proto:
	cd out && python -m http.server

typecheck:
	npm run typecheck

install-hooks:
	@echo "Installing git hooks..."
	cp scripts/pre-push .git/hooks/pre-push
	chmod +x .git/hooks/pre-push
	@echo "✅ pre-push hook installed. TypeScript will be checked before every push."
