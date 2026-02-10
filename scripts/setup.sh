#!/bin/bash

# =============================================
#  Sky Template - Interactive Setup Wizard
# =============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Project root (parent of scripts/)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

clear
echo ""
echo -e "${CYAN}${BOLD}  ╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}  ║       SKY TEMPLATE SETUP WIZARD      ║${NC}"
echo -e "${CYAN}${BOLD}  ╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  Project directory: ${BLUE}${PROJECT_ROOT}${NC}"
echo ""

# === Check Node.js ===
if ! command -v node &> /dev/null; then
    echo -e "${RED}  Error: Node.js is required!${NC}"
    echo -e "  Install from: ${BLUE}https://nodejs.org/${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Node.js $(node -v) detected"
echo ""

# =============================================
#  Step 1: Gather Information
# =============================================

echo -e "${YELLOW}${BOLD}  STEP 1: Company Information${NC}"
echo -e "  ─────────────────────────────"
echo ""

# Company name
read -p "  Company name: " COMPANY_NAME
while [ -z "$COMPANY_NAME" ]; do
    echo -e "  ${RED}Company name is required${NC}"
    read -p "  Company name: " COMPANY_NAME
done

# Domain
read -p "  Domain (e.g., example.com): " DOMAIN
while [ -z "$DOMAIN" ]; do
    echo -e "  ${RED}Domain is required${NC}"
    read -p "  Domain (e.g., example.com): " DOMAIN
done

# Primary color
read -p "  Primary color (hex, default #4CAF50): " PRIMARY_COLOR
PRIMARY_COLOR=${PRIMARY_COLOR:-"#4CAF50"}

# Validate hex color
if [[ ! "$PRIMARY_COLOR" =~ ^#[0-9A-Fa-f]{6}$ ]]; then
    echo -e "  ${YELLOW}Invalid hex color, using default #4CAF50${NC}"
    PRIMARY_COLOR="#4CAF50"
fi

# Contact email
read -p "  Contact email: " EMAIL
while [ -z "$EMAIL" ]; do
    echo -e "  ${RED}Email is required${NC}"
    read -p "  Contact email: " EMAIL
done

# Phone
read -p "  Phone number (optional): " PHONE
PHONE=${PHONE:-"+XX XXX XXX XXX"}

# Address
read -p "  Address (optional): " ADDRESS
ADDRESS=${ADDRESS:-"Your Address"}

# Default language
echo ""
echo -e "  Available languages: ${CYAN}en${NC}, ${CYAN}de${NC}, ${CYAN}ru${NC}"
read -p "  Default language (en): " DEFAULT_LANG
DEFAULT_LANG=${DEFAULT_LANG:-"en"}

if [[ ! "$DEFAULT_LANG" =~ ^(en|de|ru)$ ]]; then
    echo -e "  ${YELLOW}Invalid language, using 'en'${NC}"
    DEFAULT_LANG="en"
fi

# Site key (for multi-site database)
SITE_KEY=$(echo "$DOMAIN" | sed 's/\..*//g' | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]-')
SITE_KEY=${SITE_KEY:-"mysite"}

# Generate secrets
SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || echo "change-me-$(date +%s)")
ADMIN_PASSWORD=$(openssl rand -base64 12 2>/dev/null || python3 -c "import secrets; print(secrets.token_urlsafe(12))" 2>/dev/null || echo "admin123")
API_KEY=$(openssl rand -hex 16 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(16))" 2>/dev/null || echo "api-key-$(date +%s)")

# =============================================
#  Step 2: Business Examples Selection
# =============================================

echo ""
echo -e "${YELLOW}${BOLD}  STEP 2: Business Template (optional)${NC}"
echo -e "  ─────────────────────────────────────"
echo ""
echo -e "  Choose example modules to include:"
echo -e "  ${CYAN}1)${NC} Booking      - Time slot booking system"
echo -e "  ${CYAN}2)${NC} Catalog      - Extended product catalog with SKU/stock"
echo -e "  ${CYAN}3)${NC} Subscription - Subscription plans management"
echo -e "  ${CYAN}4)${NC} Blog         - Blog with posts, tags, pagination"
echo -e "  ${CYAN}5)${NC} Gallery      - Photo albums with lightbox viewer"
echo -e "  ${CYAN}6)${NC} Reviews      - Customer reviews with star ratings"
echo -e "  ${CYAN}7)${NC} FAQ          - FAQ with categories and accordion"
echo -e "  ${CYAN}8)${NC} Newsletter   - Email subscription management"
echo -e "  ${CYAN}9)${NC} Cart         - Shopping cart and checkout"
echo -e "  ${CYAN}0)${NC} Skip         - No examples"
echo ""
read -p "  Select (comma separated, e.g., 1,2): " EXAMPLES_CHOICE
EXAMPLES_CHOICE=${EXAMPLES_CHOICE:-"0"}

ENABLE_BOOKING=false
ENABLE_CATALOG=false
ENABLE_SUBSCRIPTION=false
ENABLE_BLOG=false
ENABLE_GALLERY=false
ENABLE_REVIEWS=false
ENABLE_FAQ=false
ENABLE_NEWSLETTER=false
ENABLE_CART=false

IFS=',' read -ra SELECTED <<< "$EXAMPLES_CHOICE"
for choice in "${SELECTED[@]}"; do
    choice=$(echo "$choice" | tr -d ' ')
    case "$choice" in
        1) ENABLE_BOOKING=true ;;
        2) ENABLE_CATALOG=true ;;
        3) ENABLE_SUBSCRIPTION=true ;;
        4) ENABLE_BLOG=true ;;
        5) ENABLE_GALLERY=true ;;
        6) ENABLE_REVIEWS=true ;;
        7) ENABLE_FAQ=true ;;
        8) ENABLE_NEWSLETTER=true ;;
        9) ENABLE_CART=true ;;
    esac
done

# =============================================
#  Step 3: Summary & Confirmation
# =============================================

echo ""
echo -e "${YELLOW}${BOLD}  STEP 3: Configuration Summary${NC}"
echo -e "  ──────────────────────────────"
echo ""
echo -e "  Company:        ${GREEN}${COMPANY_NAME}${NC}"
echo -e "  Domain:         ${GREEN}${DOMAIN}${NC}"
echo -e "  Primary color:  ${GREEN}${PRIMARY_COLOR}${NC}"
echo -e "  Email:          ${GREEN}${EMAIL}${NC}"
echo -e "  Phone:          ${GREEN}${PHONE}${NC}"
echo -e "  Address:        ${GREEN}${ADDRESS}${NC}"
echo -e "  Default lang:   ${GREEN}${DEFAULT_LANG}${NC}"
echo -e "  Site key:       ${GREEN}${SITE_KEY}${NC}"
echo ""
echo -e "  Examples:"
echo -e "    Booking:      $( [ "$ENABLE_BOOKING" = true ] && echo "${GREEN}YES${NC}" || echo "${RED}NO${NC}" )"
echo -e "    Catalog:      $( [ "$ENABLE_CATALOG" = true ] && echo "${GREEN}YES${NC}" || echo "${RED}NO${NC}" )"
echo -e "    Subscription: $( [ "$ENABLE_SUBSCRIPTION" = true ] && echo "${GREEN}YES${NC}" || echo "${RED}NO${NC}" )"
echo -e "    Blog:         $( [ "$ENABLE_BLOG" = true ] && echo "${GREEN}YES${NC}" || echo "${RED}NO${NC}" )"
echo -e "    Gallery:      $( [ "$ENABLE_GALLERY" = true ] && echo "${GREEN}YES${NC}" || echo "${RED}NO${NC}" )"
echo -e "    Reviews:      $( [ "$ENABLE_REVIEWS" = true ] && echo "${GREEN}YES${NC}" || echo "${RED}NO${NC}" )"
echo -e "    FAQ:          $( [ "$ENABLE_FAQ" = true ] && echo "${GREEN}YES${NC}" || echo "${RED}NO${NC}" )"
echo -e "    Newsletter:   $( [ "$ENABLE_NEWSLETTER" = true ] && echo "${GREEN}YES${NC}" || echo "${RED}NO${NC}" )"
echo -e "    Cart:         $( [ "$ENABLE_CART" = true ] && echo "${GREEN}YES${NC}" || echo "${RED}NO${NC}" )"
echo ""
echo -e "  Admin password: ${YELLOW}${ADMIN_PASSWORD}${NC}"
echo ""
read -p "  Proceed with setup? (Y/n): " CONFIRM
CONFIRM=${CONFIRM:-"Y"}

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "\n  ${RED}Setup cancelled.${NC}"
    exit 0
fi

# =============================================
#  Step 4: Apply Configuration
# =============================================

echo ""
echo -e "${YELLOW}${BOLD}  Applying configuration...${NC}"
echo ""

# Escape special characters for sed
escape_sed() {
    echo "$1" | sed 's/[&/\]/\\&/g'
}

COMPANY_ESC=$(escape_sed "$COMPANY_NAME")
DOMAIN_ESC=$(escape_sed "$DOMAIN")
COLOR_ESC=$(escape_sed "$PRIMARY_COLOR")
EMAIL_ESC=$(escape_sed "$EMAIL")
PHONE_ESC=$(escape_sed "$PHONE")
ADDRESS_ESC=$(escape_sed "$ADDRESS")

# Function to replace placeholders in a file
replace_placeholders() {
    local file="$1"
    if [ -f "$file" ]; then
        sed -i.bak \
            -e "s/__COMPANY_NAME__/${COMPANY_ESC}/g" \
            -e "s/__DOMAIN__/${DOMAIN_ESC}/g" \
            -e "s/__PRIMARY_COLOR__/${COLOR_ESC}/g" \
            -e "s/__EMAIL__/${EMAIL_ESC}/g" \
            -e "s/__PHONE__/${PHONE_ESC}/g" \
            -e "s/__ADDRESS__/${ADDRESS_ESC}/g" \
            -e "s/__DEFAULT_LANG__/${DEFAULT_LANG}/g" \
            -e "s/__SITE_KEY__/${SITE_KEY}/g" \
            -e "s/__SESSION_SECRET__/${SESSION_SECRET}/g" \
            -e "s/__ADMIN_PASSWORD__/${ADMIN_PASSWORD}/g" \
            -e "s/__API_KEY__/${API_KEY}/g" \
            "$file"
        rm -f "${file}.bak"
    fi
}

# Replace in frontend files
echo -e "  ${BLUE}→${NC} Configuring frontend..."
for file in "$PROJECT_ROOT"/frontend/*.html; do
    replace_placeholders "$file"
done

for file in "$PROJECT_ROOT"/frontend/css/*.css; do
    replace_placeholders "$file"
done

for file in "$PROJECT_ROOT"/frontend/js/config.js; do
    replace_placeholders "$file"
done

for file in "$PROJECT_ROOT"/frontend/locales/*.json; do
    replace_placeholders "$file"
done

echo -e "  ${GREEN}✓${NC} Frontend configured"

# Replace in admin panel
echo -e "  ${BLUE}→${NC} Configuring admin panel..."
replace_placeholders "$PROJECT_ROOT/admin-panel/.env.example"

# Create actual .env from example
cp "$PROJECT_ROOT/admin-panel/.env.example" "$PROJECT_ROOT/admin-panel/.env"
echo -e "  ${GREEN}✓${NC} Admin panel configured"

# Install dependencies
echo -e "  ${BLUE}→${NC} Installing dependencies..."
cd "$PROJECT_ROOT/admin-panel" && npm install --silent 2>/dev/null
echo -e "  ${GREEN}✓${NC} Dependencies installed"

# Copy selected examples
if [ "$ENABLE_BOOKING" = true ]; then
    echo -e "  ${BLUE}→${NC} Enabling booking module..."
    if [ -f "$PROJECT_ROOT/admin-panel/routes/examples/booking.js" ]; then
        cp "$PROJECT_ROOT/admin-panel/routes/examples/booking.js" "$PROJECT_ROOT/admin-panel/routes/booking.js"
        cp "$PROJECT_ROOT/frontend/js/examples/booking.js" "$PROJECT_ROOT/frontend/js/booking.js"
        echo -e "  ${GREEN}✓${NC} Booking module enabled"
    fi
fi

if [ "$ENABLE_CATALOG" = true ]; then
    echo -e "  ${BLUE}→${NC} Enabling catalog module..."
    if [ -f "$PROJECT_ROOT/admin-panel/routes/examples/catalog.js" ]; then
        cp "$PROJECT_ROOT/admin-panel/routes/examples/catalog.js" "$PROJECT_ROOT/admin-panel/routes/catalog.js"
        cp "$PROJECT_ROOT/frontend/js/examples/catalog.js" "$PROJECT_ROOT/frontend/js/catalog.js"
        echo -e "  ${GREEN}✓${NC} Catalog module enabled"
    fi
fi

if [ "$ENABLE_SUBSCRIPTION" = true ]; then
    echo -e "  ${BLUE}→${NC} Enabling subscription module..."
    if [ -f "$PROJECT_ROOT/admin-panel/routes/examples/subscription.js" ]; then
        cp "$PROJECT_ROOT/admin-panel/routes/examples/subscription.js" "$PROJECT_ROOT/admin-panel/routes/subscription.js"
        cp "$PROJECT_ROOT/frontend/js/examples/subscription.js" "$PROJECT_ROOT/frontend/js/subscription.js"
        echo -e "  ${GREEN}✓${NC} Subscription module enabled"
    fi
fi

if [ "$ENABLE_BLOG" = true ]; then
    echo -e "  ${BLUE}→${NC} Enabling blog module..."
    if [ -f "$PROJECT_ROOT/admin-panel/routes/examples/blog.js" ]; then
        cp "$PROJECT_ROOT/admin-panel/routes/examples/blog.js" "$PROJECT_ROOT/admin-panel/routes/blog.js"
        cp "$PROJECT_ROOT/frontend/js/examples/blog.js" "$PROJECT_ROOT/frontend/js/blog.js"
        echo -e "  ${GREEN}✓${NC} Blog module enabled"
    fi
fi

if [ "$ENABLE_GALLERY" = true ]; then
    echo -e "  ${BLUE}→${NC} Enabling gallery module..."
    if [ -f "$PROJECT_ROOT/admin-panel/routes/examples/gallery.js" ]; then
        cp "$PROJECT_ROOT/admin-panel/routes/examples/gallery.js" "$PROJECT_ROOT/admin-panel/routes/gallery.js"
        cp "$PROJECT_ROOT/frontend/js/examples/gallery.js" "$PROJECT_ROOT/frontend/js/gallery.js"
        echo -e "  ${GREEN}✓${NC} Gallery module enabled"
    fi
fi

if [ "$ENABLE_REVIEWS" = true ]; then
    echo -e "  ${BLUE}→${NC} Enabling reviews module..."
    if [ -f "$PROJECT_ROOT/admin-panel/routes/examples/reviews.js" ]; then
        cp "$PROJECT_ROOT/admin-panel/routes/examples/reviews.js" "$PROJECT_ROOT/admin-panel/routes/reviews.js"
        cp "$PROJECT_ROOT/frontend/js/examples/reviews.js" "$PROJECT_ROOT/frontend/js/reviews.js"
        echo -e "  ${GREEN}✓${NC} Reviews module enabled"
    fi
fi

if [ "$ENABLE_FAQ" = true ]; then
    echo -e "  ${BLUE}→${NC} Enabling FAQ module..."
    if [ -f "$PROJECT_ROOT/admin-panel/routes/examples/faq.js" ]; then
        cp "$PROJECT_ROOT/admin-panel/routes/examples/faq.js" "$PROJECT_ROOT/admin-panel/routes/faq.js"
        cp "$PROJECT_ROOT/frontend/js/examples/faq.js" "$PROJECT_ROOT/frontend/js/faq.js"
        echo -e "  ${GREEN}✓${NC} FAQ module enabled"
    fi
fi

if [ "$ENABLE_NEWSLETTER" = true ]; then
    echo -e "  ${BLUE}→${NC} Enabling newsletter module..."
    if [ -f "$PROJECT_ROOT/admin-panel/routes/examples/newsletter.js" ]; then
        cp "$PROJECT_ROOT/admin-panel/routes/examples/newsletter.js" "$PROJECT_ROOT/admin-panel/routes/newsletter.js"
        cp "$PROJECT_ROOT/frontend/js/examples/newsletter.js" "$PROJECT_ROOT/frontend/js/newsletter.js"
        echo -e "  ${GREEN}✓${NC} Newsletter module enabled"
    fi
fi

if [ "$ENABLE_CART" = true ]; then
    echo -e "  ${BLUE}→${NC} Enabling cart module..."
    if [ -f "$PROJECT_ROOT/admin-panel/routes/examples/cart.js" ]; then
        cp "$PROJECT_ROOT/admin-panel/routes/examples/cart.js" "$PROJECT_ROOT/admin-panel/routes/cart.js"
        cp "$PROJECT_ROOT/frontend/js/examples/cart.js" "$PROJECT_ROOT/frontend/js/cart.js"
        echo -e "  ${GREEN}✓${NC} Cart module enabled"
    fi
fi

# =============================================
#  Step 5: Create PROJECT_CONFIG.md
# =============================================

cat > "$PROJECT_ROOT/PROJECT_CONFIG.md" << CONFIGEOF
# Project Configuration

Generated by Sky Template Setup Wizard on $(date '+%Y-%m-%d %H:%M')

## Settings

| Setting | Value |
|---------|-------|
| Company | ${COMPANY_NAME} |
| Domain | ${DOMAIN} |
| Primary Color | ${PRIMARY_COLOR} |
| Email | ${EMAIL} |
| Phone | ${PHONE} |
| Address | ${ADDRESS} |
| Default Language | ${DEFAULT_LANG} |
| Site Key | ${SITE_KEY} |

## Admin Panel

- URL: http://localhost:7001
- Username: admin
- Password: ${ADMIN_PASSWORD}

## Enabled Modules

- Booking: $( [ "$ENABLE_BOOKING" = true ] && echo "Yes" || echo "No" )
- Catalog: $( [ "$ENABLE_CATALOG" = true ] && echo "Yes" || echo "No" )
- Subscription: $( [ "$ENABLE_SUBSCRIPTION" = true ] && echo "Yes" || echo "No" )
- Blog: $( [ "$ENABLE_BLOG" = true ] && echo "Yes" || echo "No" )
- Gallery: $( [ "$ENABLE_GALLERY" = true ] && echo "Yes" || echo "No" )
- Reviews: $( [ "$ENABLE_REVIEWS" = true ] && echo "Yes" || echo "No" )
- FAQ: $( [ "$ENABLE_FAQ" = true ] && echo "Yes" || echo "No" )
- Newsletter: $( [ "$ENABLE_NEWSLETTER" = true ] && echo "Yes" || echo "No" )
- Cart: $( [ "$ENABLE_CART" = true ] && echo "Yes" || echo "No" )

## Quick Commands

\`\`\`bash
# Start admin panel
cd admin-panel && npm start

# Start frontend (dev server)
cd frontend && npx http-server -p 3000
\`\`\`
CONFIGEOF

echo -e "  ${GREEN}✓${NC} PROJECT_CONFIG.md created"

# =============================================
#  Done!
# =============================================

echo ""
echo -e "${GREEN}${BOLD}  ╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}  ║         SETUP COMPLETE!              ║${NC}"
echo -e "${GREEN}${BOLD}  ╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Next steps:${NC}"
echo ""
echo -e "  1. Start the admin panel:"
echo -e "     ${CYAN}cd ${PROJECT_ROOT}/admin-panel && npm start${NC}"
echo ""
echo -e "  2. Open admin panel:"
echo -e "     ${CYAN}http://localhost:7001${NC}"
echo -e "     Login: ${GREEN}admin${NC} / ${YELLOW}${ADMIN_PASSWORD}${NC}"
echo ""
echo -e "  3. Start the frontend:"
echo -e "     ${CYAN}cd ${PROJECT_ROOT}/frontend && npx http-server -p 3000${NC}"
echo ""
echo -e "  4. Open your site:"
echo -e "     ${CYAN}http://localhost:3000${NC}"
echo ""
echo -e "  ${BOLD}Config saved to:${NC} PROJECT_CONFIG.md"
echo ""
