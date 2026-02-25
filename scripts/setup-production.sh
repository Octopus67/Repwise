#!/bin/bash
# =============================================================================
# HypertrophyOS Production Setup Script
# =============================================================================
# This script automates as much of the production setup as possible.
# Run it after creating your accounts and installing the CLIs.
#
# PREREQUISITES (create these accounts first — ~30 min total):
#   1. Railway   → railway.app          (GitHub login, $5/mo)
#   2. Neon      → neon.tech            (GitHub login, free)
#   3. Cloudflare→ cloudflare.com       (email signup, free)
#   4. Stripe    → stripe.com           (email + business info)
#   5. Razorpay  → razorpay.com         (email + business info)
#   6. Sentry    → sentry.io            (GitHub login, free)
#   7. Firebase  → console.firebase.google.com (Google account, free)
#   8. Expo      → expo.dev             (GitHub login, free)
#   9. Apple Dev → developer.apple.com  ($99/yr, takes 24-48h)
#  10. Google Play→ play.google.com/console ($25 one-time)
#
# INSTALL THESE CLIs:
#   brew install railway stripe/stripe-cli/stripe
#   npm install -g eas-cli
#   curl -sSL https://neon.tech/install | sh
#
# Then run: ./scripts/setup-production.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   HypertrophyOS Production Setup              ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ---------------------------------------------------------------------------
# Step 0: Check prerequisites
# ---------------------------------------------------------------------------
echo -e "${YELLOW}[0/8] Checking prerequisites...${NC}"

MISSING=""
command -v railway >/dev/null 2>&1 || MISSING="$MISSING railway"
command -v stripe  >/dev/null 2>&1 || MISSING="$MISSING stripe"
command -v eas     >/dev/null 2>&1 || MISSING="$MISSING eas-cli"

if [ -n "$MISSING" ]; then
  echo -e "${RED}Missing CLIs:${MISSING}${NC}"
  echo ""
  echo "Install them:"
  echo "  brew install railway stripe/stripe-cli/stripe"
  echo "  npm install -g eas-cli"
  echo ""
  echo "Then re-run this script."
  exit 1
fi

echo -e "${GREEN}  ✓ All CLIs found${NC}"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Generate secrets
# ---------------------------------------------------------------------------
echo -e "${YELLOW}[1/8] Generating production secrets...${NC}"

JWT_SECRET=$(openssl rand -hex 32)
echo -e "${GREEN}  ✓ JWT_SECRET generated (${#JWT_SECRET} chars)${NC}"

# Save to a local .env.production (gitignored)
cat > .env.production <<EOF
# =============================================================================
# HypertrophyOS Production Environment Variables
# Generated on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# =============================================================================
# IMPORTANT: Do NOT commit this file. Add to .gitignore if not already there.

# --- Generated ---
JWT_SECRET=${JWT_SECRET}
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
DEBUG=false

# --- Fill these in from your provider dashboards ---
# Neon (Section 2 of docs/deployment.md)
DATABASE_URL=postgresql+asyncpg://USER:PASS@HOST/DB?ssl=require

# Stripe (dashboard.stripe.com → Developers → API keys)
STRIPE_API_KEY=sk_live_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME

# Razorpay (dashboard.razorpay.com → Settings → API Keys)
RAZORPAY_KEY_ID=rzp_live_REPLACE_ME
RAZORPAY_KEY_SECRET=REPLACE_ME
RAZORPAY_WEBHOOK_SECRET=REPLACE_ME

# Cloudflare R2 (dash.cloudflare.com → R2 → Manage API Tokens)
R2_ACCESS_KEY=REPLACE_ME
R2_SECRET_KEY=REPLACE_ME
R2_ENDPOINT_URL=https://ACCOUNT_ID.r2.cloudflarestorage.com
R2_BUCKET_NAME=hypertrophy-os-uploads

# Sentry (sentry.io → Project Settings → Client Keys)
SENTRY_DSN=REPLACE_ME

# Firebase (console.firebase.google.com → Project Settings → Cloud Messaging)
FCM_SERVER_KEY=REPLACE_ME

# USDA (fdc.nal.usda.gov/api-key-signup.html)
USDA_API_KEY=REPLACE_ME

# CORS
CORS_ORIGINS=["https://hypertrophyos.com"]
EOF

echo -e "${GREEN}  ✓ .env.production created — fill in the REPLACE_ME values${NC}"

# Ensure it's gitignored
if ! grep -q ".env.production" .gitignore 2>/dev/null; then
  echo ".env.production" >> .gitignore
  echo -e "${GREEN}  ✓ Added .env.production to .gitignore${NC}"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 2: Railway setup
# ---------------------------------------------------------------------------
echo -e "${YELLOW}[2/8] Railway setup...${NC}"
echo -e "  ${CYAN}This will open Railway login if needed.${NC}"
echo ""

if railway status 2>/dev/null | grep -q "Project"; then
  echo -e "${GREEN}  ✓ Already linked to a Railway project${NC}"
else
  echo -e "  Run these commands manually:"
  echo -e "    ${CYAN}railway login${NC}"
  echo -e "    ${CYAN}railway init${NC}  (or ${CYAN}railway link${NC} if project exists)"
  echo ""
  echo -e "  Then set env vars:"
  echo -e "    ${CYAN}railway variables set \$(cat .env.production | grep -v '^#' | grep -v '^$' | tr '\\n' ' ')${NC}"
  echo ""
  echo -e "  Or paste them one by one in the Railway dashboard → Variables tab."
fi

echo ""

# ---------------------------------------------------------------------------
# Step 3: Stripe webhook setup
# ---------------------------------------------------------------------------
echo -e "${YELLOW}[3/8] Stripe webhook setup...${NC}"
echo ""
echo -e "  After logging into Stripe CLI (${CYAN}stripe login${NC}), create webhooks:"
echo ""
echo -e "  ${CYAN}stripe webhooks create \\${NC}"
echo -e "  ${CYAN}  --url https://api.hypertrophyos.com/api/v1/payments/webhook/stripe \\${NC}"
echo -e "  ${CYAN}  --events invoice.paid,invoice.payment_failed,customer.subscription.deleted,customer.subscription.updated${NC}"
echo ""
echo -e "  Copy the webhook signing secret (whsec_...) into .env.production"
echo ""

# ---------------------------------------------------------------------------
# Step 4: Stripe products
# ---------------------------------------------------------------------------
echo -e "${YELLOW}[4/8] Creating Stripe subscription products...${NC}"
echo ""

# Check if stripe is logged in
if stripe config --list 2>/dev/null | grep -q "test_mode"; then
  echo -e "  Creating products via Stripe CLI..."

  # Create the product
  PRODUCT_ID=$(stripe products create \
    --name="HOS Premium" \
    --description="Hypertrophy OS Premium subscription" \
    2>/dev/null | grep '"id"' | head -1 | sed 's/.*: "\(.*\)".*/\1/' || echo "")

  if [ -n "$PRODUCT_ID" ]; then
    echo -e "${GREEN}  ✓ Product created: ${PRODUCT_ID}${NC}"

    # Create monthly price
    MONTHLY_PRICE=$(stripe prices create \
      --product="$PRODUCT_ID" \
      --unit-amount=999 \
      --currency=usd \
      --recurring-interval=month \
      2>/dev/null | grep '"id"' | head -1 | sed 's/.*: "\(.*\)".*/\1/' || echo "")

    if [ -n "$MONTHLY_PRICE" ]; then
      echo -e "${GREEN}  ✓ Monthly price: ${MONTHLY_PRICE} (\$9.99/mo)${NC}"
    fi

    # Create annual price
    ANNUAL_PRICE=$(stripe prices create \
      --product="$PRODUCT_ID" \
      --unit-amount=7999 \
      --currency=usd \
      --recurring-interval=year \
      2>/dev/null | grep '"id"' | head -1 | sed 's/.*: "\(.*\)".*/\1/' || echo "")

    if [ -n "$ANNUAL_PRICE" ]; then
      echo -e "${GREEN}  ✓ Annual price: ${ANNUAL_PRICE} (\$79.99/yr)${NC}"
    fi

    if [ -n "$MONTHLY_PRICE" ] && [ -n "$ANNUAL_PRICE" ]; then
      echo ""
      echo -e "  ${CYAN}Update STRIPE_PRICE_MAP in src/modules/payments/stripe_provider.py:${NC}"
      echo -e "    \"monthly\": \"${MONTHLY_PRICE}\","
      echo -e "    \"annual\": \"${ANNUAL_PRICE}\","
    fi
  else
    echo -e "${YELLOW}  ⚠ Could not create product. Do it manually in Stripe Dashboard.${NC}"
  fi
else
  echo -e "  ${YELLOW}Stripe CLI not logged in. Run: stripe login${NC}"
  echo -e "  Then re-run this script, or create products manually in the Stripe Dashboard."
fi

echo ""

# ---------------------------------------------------------------------------
# Step 5: Generate JWT secret reminder
# ---------------------------------------------------------------------------
echo -e "${YELLOW}[5/8] Database migration prep...${NC}"
echo ""
echo -e "  Once you have your Neon DATABASE_URL, run:"
echo -e "    ${CYAN}export DATABASE_URL=\"postgresql+asyncpg://user:pass@host/db?ssl=require\"${NC}"
echo -e "    ${CYAN}alembic upgrade head${NC}"
echo ""
echo -e "  This creates all tables including the new notifications tables."
echo ""

# ---------------------------------------------------------------------------
# Step 6: EAS Build setup
# ---------------------------------------------------------------------------
echo -e "${YELLOW}[6/8] EAS Build setup...${NC}"
echo ""

if eas whoami 2>/dev/null; then
  echo -e "${GREEN}  ✓ Logged into EAS${NC}"
else
  echo -e "  ${CYAN}Run: eas login${NC}"
fi

echo ""
echo -e "  To build for both platforms:"
echo -e "    ${CYAN}cd app && eas build --profile production --platform all --non-interactive${NC}"
echo ""
echo -e "  To submit to stores:"
echo -e "    ${CYAN}cd app && eas submit --platform ios --profile production${NC}"
echo -e "    ${CYAN}cd app && eas submit --platform android --profile production${NC}"
echo ""

# ---------------------------------------------------------------------------
# Step 7: Sentry setup
# ---------------------------------------------------------------------------
echo -e "${YELLOW}[7/8] Sentry DSN reminder...${NC}"
echo ""
echo -e "  1. Create a Python project at sentry.io → get the DSN"
echo -e "  2. Create a React Native project → get the DSN"
echo -e "  3. Set SENTRY_DSN in .env.production (backend)"
echo -e "  4. Set EXPO_PUBLIC_SENTRY_DSN in app/eas.json production env (frontend)"
echo ""

# ---------------------------------------------------------------------------
# Step 8: Summary
# ---------------------------------------------------------------------------
echo -e "${YELLOW}[8/8] Summary — what you need to do manually...${NC}"
echo ""
echo -e "${CYAN}┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${CYAN}│  YOUR MANUAL CHECKLIST (in order)                          │${NC}"
echo -e "${CYAN}├─────────────────────────────────────────────────────────────┤${NC}"
echo -e "${CYAN}│                                                             │${NC}"
echo -e "${CYAN}│  □ 1. Fill in REPLACE_ME values in .env.production          │${NC}"
echo -e "${CYAN}│  □ 2. railway login && railway link                         │${NC}"
echo -e "${CYAN}│  □ 3. Set env vars in Railway dashboard (paste from .env)   │${NC}"
echo -e "${CYAN}│  □ 4. Push to main → Railway auto-deploys                   │${NC}"
echo -e "${CYAN}│  □ 5. Run: alembic upgrade head (against Neon)              │${NC}"
echo -e "${CYAN}│  □ 6. Verify: curl https://api.hypertrophyos.com/api/v1/health │${NC}"
echo -e "${CYAN}│  □ 7. stripe login && create webhook (see step 3 above)     │${NC}"
echo -e "${CYAN}│  □ 8. cd app && eas build --profile production --platform all │${NC}"
echo -e "${CYAN}│  □ 9. Submit to App Store and Google Play                   │${NC}"
echo -e "${CYAN}│  □ 10. Create reviewer@hypertrophyos.com demo account       │${NC}"
echo -e "${CYAN}│                                                             │${NC}"
echo -e "${CYAN}│  Estimated time: 2-3 hours (mostly waiting for builds)      │${NC}"
echo -e "${CYAN}└─────────────────────────────────────────────────────────────┘${NC}"
echo ""
echo -e "${GREEN}Setup script complete. Open .env.production and start filling in values.${NC}"
