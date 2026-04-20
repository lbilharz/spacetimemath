# Makefile for spacetimemath
# Usage:
#   make setup           – install git hooks (run once after cloning)
#   make publish         – build WASM + publish to maincloud (non-interactive)
#   make publish-test    – publish WASM to spacetimemath-test on maincloud (for integration tests)
#   make generate        – regenerate TypeScript bindings from server source
#   make call REDUCER=x  – call a reducer on maincloud
#   make deploy          – publish + generate + integration tests + E2E tests
#   make backup          – export all durable tables to recovery/backups/ (run before risky publishes)

SPACETIME  ?= $(HOME)/.local/bin/spacetime
CARGO      ?= $(HOME)/.cargo/bin/cargo
WASM_BIN   := server/target/wasm32-unknown-unknown/release/spacetimemath.wasm

# Install git hooks (run once after cloning)
setup:
	git config core.hooksPath hooks

# Safety check: block any accidental --delete-data in MAKEFLAGS or CLI overrides.
# If you genuinely need to wipe production data, use: make wipe-and-publish CONFIRM_WIPE=yes
check-no-delete-data:
	@if echo "$(MAKEFLAGS) $(EXTRA)" | grep -q -- '--delete-data'; then \
		echo ""; \
		echo "ERROR: --delete-data detected. This wipes ALL production data."; \
		echo "Use: make wipe-and-publish CONFIRM_WIPE=yes"; \
		echo ""; \
		exit 1; \
	fi

# Build WASM then publish to maincloud non-interactively.
# NEVER passes --delete-data. Use wipe-and-publish only if you need to reset data.
publish: check-no-delete-data
	cd server && $(CARGO) build --target wasm32-unknown-unknown --release
	$(SPACETIME) publish spacetimemath --server maincloud --bin-path $(WASM_BIN) -y

# Publish WASM to the integration test database on maincloud
publish-test:
	cd server && $(CARGO) build --target wasm32-unknown-unknown --release
	$(SPACETIME) publish spacetimemath-test --server maincloud --bin-path $(WASM_BIN) -y

# DANGER: wipes ALL production data before publishing.
# Requires explicit confirmation: make wipe-and-publish CONFIRM_WIPE=yes
# 		       Run: make backup  (then check recovery/backups/ before continuing)
wipe-and-publish:
	@if [ "$(CONFIRM_WIPE)" != "yes" ]; then \
		echo ""; \
		echo "ERROR: This target wipes ALL production data. This cannot be undone."; \
		echo "       Export CSVs from SpacetimeDB web console first."; \
		echo "       Then run: make wipe-and-publish CONFIRM_WIPE=yes"; \
		echo ""; \
		exit 1; \
	fi
	cd server && $(CARGO) build --target wasm32-unknown-unknown --release
	$(SPACETIME) publish spacetimemath --server maincloud --bin-path $(WASM_BIN) -y --delete-data

# Export all durable tables to a timestamped backup in recovery/backups/.
# Run this before any risky schema-breaking publish.
backup:
	bash recovery/backup.sh

# Regenerate TypeScript module bindings from the server source,
# then re-add private table registrations that codegen skips.
generate:
	zsh -c 'source $$HOME/.cargo/env && $(SPACETIME) generate --lang typescript --out-dir client/src/module_bindings --module-path server'
	node client/scripts/patch-private-tables.mjs

# Call a reducer: make call REDUCER=migrate_seed_best_scores
call:
	@if [ -z "$(REDUCER)" ]; then echo "Usage: make call REDUCER=<reducer_name>"; exit 1; fi
	$(SPACETIME) call spacetimemath $(REDUCER) --server maincloud

# Full deploy: publish + regenerate bindings + integration tests + E2E tests
deploy: publish generate
	cd client && npm run test:integration
	cd client && npm run test:e2e:ci

# Run Playwright E2E tests against a locally running dev server
# (uses concurrently + wait-on; see test:e2e:ci script in client/package.json)
test-e2e:
	cd client && npm run test:e2e:ci

# App packaging and release
app-release-beta:
	cd client/ios/App && bundle exec fastlane beta
	cd client/android && fastlane beta

app-release-metadata:
	cd client/ios/App && bundle exec fastlane metadata
	cd client/android && fastlane metadata

app-screenshots:
	cd client && npm run screenshots

.PHONY: setup publish publish-test generate call deploy test test-e2e check-no-delete-data wipe-and-publish backup app-release-beta app-release-metadata app-screenshots
