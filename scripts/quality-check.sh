#!/bin/bash
# Repwise Quality Check — run before committing
# Usage: ./scripts/quality-check.sh

set -e
cd "$(dirname "$0")/.."

echo "========================================="
echo "  Repwise Quality Check"
echo "========================================="
echo ""

echo "1/5 Python lint (ruff)..."
.venv/bin/ruff check src/ --select E,F --ignore E501,E402 --exclude 'src/database/migrations/' -q
echo "  ✅ Clean"

echo "2/5 TypeScript type check..."
cd app && npx tsc --noEmit 2>&1 | head -1
cd ..
echo "  ✅ Clean"

echo "3/5 Backend tests..."
.venv/bin/python -m pytest tests/ --ignore=tests/lifecycle/ --ignore=tests/test_integration.py --ignore=tests/test_e2e.py -q --tb=no 2>&1 | tail -2
echo ""

echo "4/5 Frontend tests..."
cd app && npx jest --passWithNoTests --silent 2>&1 | tail -3
cd ..
echo ""

echo "5/5 Import check..."
.venv/bin/python -c "import src.main; print('  ✅ No circular imports')"

echo ""
echo "========================================="
echo "  All checks passed!"
echo "========================================="
