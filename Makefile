# Makefile for spacetimemath
# Usage:
#   make publish         – publish server to maincloud (non-interactive, auto-confirms)
#   make generate        – regenerate TypeScript bindings from server/src/lib.rs
#   make call REDUCER=x  – call a reducer, e.g. make call REDUCER=migrate_seed_best_scores
#   make deploy          – publish + generate in one step

SPACETIME := /Users/lbi/.local/bin/spacetime
CARGO_ENV  := source $$HOME/.cargo/env

# Confirm and publish the server module to maincloud
publish:
	zsh -c '$(CARGO_ENV) && printf "y\n" | $(SPACETIME) publish spacetimemath --server maincloud'

# Regenerate TypeScript module bindings from the server source
generate:
	zsh -c '$(CARGO_ENV) && $(SPACETIME) generate --lang typescript --out-dir client/src/module_bindings --module-path server'

# Call a reducer: make call REDUCER=migrate_seed_best_scores
call:
	@if [ -z "$(REDUCER)" ]; then echo "Usage: make call REDUCER=<reducer_name>"; exit 1; fi
	$(SPACETIME) call spacetimemath $(REDUCER) --server maincloud

# Full deploy: publish + regenerate bindings
deploy: publish generate

.PHONY: publish generate call deploy
