# Makefile for spacetimemath
# Usage:
#   make publish         – build WASM + publish to maincloud (non-interactive)
#   make generate        – regenerate TypeScript bindings from server source
#   make call REDUCER=x  – call a reducer on maincloud
#   make deploy          – publish + generate in one step

SPACETIME  := /Users/lbi/.local/bin/spacetime
CARGO      := /Users/lbi/.cargo/bin/cargo
WASM_BIN   := server/target/wasm32-unknown-unknown/release/spacetimemath.wasm

# Build WASM then publish to maincloud non-interactively
publish:
	cd server && $(CARGO) build --target wasm32-unknown-unknown --release
	$(SPACETIME) publish spacetimemath --server maincloud --bin-path $(WASM_BIN) -y

# Regenerate TypeScript module bindings from the server source
generate:
	zsh -c 'source $$HOME/.cargo/env && $(SPACETIME) generate --lang typescript --out-dir client/src/module_bindings --module-path server'

# Call a reducer: make call REDUCER=migrate_seed_best_scores
call:
	@if [ -z "$(REDUCER)" ]; then echo "Usage: make call REDUCER=<reducer_name>"; exit 1; fi
	$(SPACETIME) call spacetimemath $(REDUCER) --server maincloud

# Full deploy: publish + regenerate bindings
deploy: publish generate

.PHONY: publish generate call deploy
