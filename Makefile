# Makefile for spacetimemath
# Usage:
#   make setup           – install git hooks (run once after cloning)
#   make publish         – build WASM + publish to maincloud (non-interactive)
#   make publish-test    – publish WASM to spacetimemath-test on maincloud (for integration tests)
#   make generate        – regenerate TypeScript bindings from server source
#   make call REDUCER=x  – call a reducer on maincloud
#   make deploy          – publish + generate + run integration tests

SPACETIME  := /Users/lbi/.local/bin/spacetime
CARGO      := /Users/lbi/.cargo/bin/cargo
WASM_BIN   := server/target/wasm32-unknown-unknown/release/spacetimemath.wasm

# Install git hooks (run once after cloning)
setup:
	git config core.hooksPath hooks

# Build WASM then publish to maincloud non-interactively
publish:
	cd server && $(CARGO) build --target wasm32-unknown-unknown --release
	$(SPACETIME) publish spacetimemath --server maincloud --bin-path $(WASM_BIN) -y

# Publish WASM to the integration test database on maincloud
publish-test:
	cd server && $(CARGO) build --target wasm32-unknown-unknown --release
	$(SPACETIME) publish spacetimemath-test --server maincloud --bin-path $(WASM_BIN) -y

# Regenerate TypeScript module bindings from the server source,
# then re-add private table registrations that codegen skips.
generate:
	zsh -c 'source $$HOME/.cargo/env && $(SPACETIME) generate --lang typescript --out-dir client/src/module_bindings --module-path server'
	node client/scripts/patch-private-tables.mjs

# Call a reducer: make call REDUCER=migrate_seed_best_scores
call:
	@if [ -z "$(REDUCER)" ]; then echo "Usage: make call REDUCER=<reducer_name>"; exit 1; fi
	$(SPACETIME) call spacetimemath $(REDUCER) --server maincloud

# Full deploy: publish + regenerate bindings + verify integration tests pass
deploy: publish generate
	cd client && npm run test:integration

.PHONY: setup publish publish-test generate call deploy test
