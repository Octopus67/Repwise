#!/bin/bash
# =============================================================================
# Repwise Deploy to Production
# =============================================================================
# Run this AFTER you've filled in .env.production with real values.
# It pushes env vars to Railway and runs migrations.
#
# Usage: ./scripts/deploy-production.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check .env.production exists and has no REPLACE_ME
if [ ! -f .env.production ]; then
  echo -e "${RED}Error: .env.production not found. Run setup-production.sh first.${NC}"
  exit 1
fi

if grep -q "REPLACE_ME" .env.production; then
  echo -e "${RED}Error: .env.production still has REPLACE_ME values. Fill them in first.${NC}"
  grep "REPLACE_ME" .env.production
  exit 1
fi

echo -e "${CYAN}Deploying Repwise to production...${NC}"
echo ""

# Step 1: Push env vars to Railway
echo -e "${YELLOW}[1/4] Pushing env vars to Railway...${NC}"
while IFS= read -r line; do
  # Skip comments and empty lines
  [[ "$line" =~ ^#.*$ ]] && continue
  [[ -z "$line" ]] && continue
  KEY=$(echo "$line" | cut -d= -f1)
  VALUE=$(echo "$line" | cut -d= -f2-)
  railway variables set "$KEY=$VALUE" 2>/dev/null && \
    echo -e "  ${GREEN}✓ ${KEY}${NC}" || \
    echo -e "  ${YELLOW}⚠ ${KEY} (set manually in Railway dashboard)${NC}"
done < .env.production
echo ""

# Step 2: Deploy (push to main triggers Railway auto-deploy)
echo -e "${YELLOW}[2/4] Triggering deploy...${NC}"
echo -e "  Railway auto-deploys on push to main."
echo -e "  If you haven't pushed yet: ${CYAN}git push origin main${NC}"
echo ""

# Step 3: Run migrations
echo -e "${YELLOW}[3/4] Running database migrations...${NC}"
source .env.production 2>/dev/null || true
if [ -n "${DATABASE_URL:-}" ] && [[ "$DATABASE_URL" != *"REPLACE_ME"* ]]; then
  export DATABASE_URL
  alembic upgrade head
  echo -e "${GREEN}  ✓ Migrations complete${NC}"
else
  echo -e "${YELLOW}  ⚠ DATABASE_URL not set. Run manually:${NC}"
  echo -e "    ${CYAN}export DATABASE_URL=your_neon_url${NC}"
  echo -e "    ${CYAN}alembic upgrade head${NC}"
fi
echo ""

# Step 4: Health check
echo -e "${YELLOW}[4/4] Health check...${NC}"
echo -e "  Once Railway finishes deploying, verify:"
echo -e "    ${CYAN}curl https://api.repwise.com/api/v1/health${NC}"
echo ""
echo -e "${GREEN}Deploy script complete.${NC}"
