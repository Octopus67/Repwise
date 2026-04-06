#!/bin/bash
# Run the full Repwise test suite.
# Usage: ./scripts/run-tests.sh [--quick]
#   --quick: skip slow backend unit tests, only run e2e + frontend

set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

QUICK=false
[[ "$1" == "--quick" ]] && QUICK=true

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN}  Repwise Test Suite${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
START=$(date +%s)

# 1. Backend E2E flow tests
echo -e "\n${YELLOW}[1/3] Backend E2E flow tests${NC}"
.venv/bin/pytest tests/e2e/ -q --tb=short 2>&1 | tail -5

# 2. Frontend type check + unit tests
echo -e "\n${YELLOW}[2/3] Frontend tests${NC}"
cd app
npx tsc --noEmit 2>&1 | tail -3
npx jest --passWithNoTests --no-coverage --silent 2>&1 | tail -3
cd "$DIR"

# 3. Backend unit tests (skip with --quick)
if [ "$QUICK" = false ]; then
  echo -e "\n${YELLOW}[3/3] Backend unit tests${NC}"
  .venv/bin/pytest tests/ --ignore=tests/e2e -q --tb=short 2>&1 | tail -5
else
  echo -e "\n${YELLOW}[3/3] Backend unit tests — SKIPPED (--quick)${NC}"
fi

END=$(date +%s)
ELAPSED=$((END - START))
echo -e "\n${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Done in ${ELAPSED}s${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
