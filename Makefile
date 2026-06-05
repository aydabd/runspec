# =============================================================================
# runspec — Makefile
# =============================================================================

.DEFAULT_GOAL := help

SHELL := /bin/bash

.PHONY: help install install-hooks setup-env lint test clean

MAMBA_ENV  := runspec
MAMBA_SPEC := $(CURDIR)/environment.yml
LINT_MODE ?= fix
USE_MAMBA ?= 1

ifeq ($(USE_MAMBA),0)
MAMBA_RUN :=
else
MAMBA_RUN := micromamba run -n $(MAMBA_ENV)
endif

BUILD_DIR := build
ENV_STAMP := $(BUILD_DIR)/.env-stamp

define mamba_env_exists
	micromamba env list --json 2>/dev/null | grep -q '/$(MAMBA_ENV)"'
endef

help: ## Show available make targets
	@echo "runspec — Available Commands:"
	@echo ""
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

setup-env: ## Setup isolated environment with micromamba (skip with USE_MAMBA=0)
	@if [ "$(USE_MAMBA)" = "0" ]; then \
		echo "Skipping micromamba setup (USE_MAMBA=0)"; \
	elif [ -f "$(ENV_STAMP)" ] && $(call mamba_env_exists) 2>/dev/null; then \
		: ; \
	else \
		if ! command -v micromamba >/dev/null 2>&1; then \
			echo "Installing micromamba..."; \
			set -o pipefail; curl -L micro.mamba.pm/install.sh | $(SHELL); \
		fi; \
		if ! $(call mamba_env_exists); then \
			echo "Creating environment '$(MAMBA_ENV)'..."; \
			micromamba create -y -f $(MAMBA_SPEC); \
		elif [ "$(CI)" != "true" ]; then \
			micromamba env update -n $(MAMBA_ENV) -f $(MAMBA_SPEC); \
		fi; \
		echo "Micromamba environment '$(MAMBA_ENV)' is ready."; \
		mkdir -p $(BUILD_DIR) && touch $(ENV_STAMP); \
	fi

install: setup-env ## Create the micromamba env and install pre-commit hooks
	@$(MAKE) --no-print-directory _install-hooks
	@echo "Done. Activate with: micromamba activate $(MAMBA_ENV)"

install-hooks: setup-env ## (Re-)install pre-commit hooks into .git/hooks
	@$(MAKE) --no-print-directory _install-hooks

_install-hooks:
	@$(MAMBA_RUN) pre-commit install
	@$(MAMBA_RUN) pre-commit install --hook-type commit-msg
ifeq ($(USE_MAMBA),1)
	@ENV_BIN="$$(micromamba info -n $(MAMBA_ENV) 2>/dev/null | awk '/env location/{print $$NF}')/bin"; \
	for hook in pre-commit commit-msg; do \
		hook_file=".git/hooks/$$hook"; \
		if [ -f "$$hook_file" ] && ! grep -q 'conda-env-path' "$$hook_file"; then \
			{ head -1 "$$hook_file"; \
			echo "# conda-env-path"; \
			echo "export PATH=\"$$ENV_BIN:\$$PATH\""; \
			tail -n +2 "$$hook_file"; \
			} > "$$hook_file.tmp" && mv "$$hook_file.tmp" "$$hook_file" && chmod +x "$$hook_file"; \
		fi; \
	done
endif

lint: setup-env ## Run all checks via pre-commit (LINT_MODE=fix|check)
	@echo "Running all checks via pre-commit (LINT_MODE=$(LINT_MODE))..."
	@$(MAMBA_RUN) pre-commit install --install-hooks >/dev/null 2>&1 || true
	@LINT_MODE=$(LINT_MODE) $(MAMBA_RUN) pre-commit run --all-files --color=always
	@echo "All checks passed"

test: setup-env ## Run executable RunSpec verification
	@$(MAMBA_RUN) npm install
	@$(MAMBA_RUN) npm test

clean: ## Remove build artefacts and cache directories
	find . -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name '.pytest_cache' -exec rm -rf {} + 2>/dev/null || true
	rm -rf $(BUILD_DIR)/ dist/ node_modules/
