#!/usr/bin/env bash
# =============================================================
#  DentaFlow — First-Time Setup Script
#  Usage: bash scripts/setup.sh
# =============================================================
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }
section() { echo -e "\n${GREEN}━━━ $1 ━━━${NC}"; }

section "DentaFlow Setup"
echo "This script will set up the backend, dashboard, and database."
echo ""

# ── Check prerequisites ────────────────────────────────────────
section "Checking Prerequisites"

command -v node  >/dev/null 2>&1 || error "Node.js is required. Install from https://nodejs.org"
command -v npm   >/dev/null 2>&1 || error "npm is required"
command -v psql  >/dev/null 2>&1 || warn  "psql not found — ensure PostgreSQL is installed and running"

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
[ "$NODE_VERSION" -lt 18 ] && error "Node.js 18+ required (found: $(node --version))"
info "Node.js $(node --version)"
info "npm $(npm --version)"

# ── Backend env ────────────────────────────────────────────────
section "Backend Configuration"

if [ ! -f "backend/.env" ]; then
  cp backend/.env.example backend/.env
  warn "Created backend/.env from example — please fill in your real values"
  warn "Required: DATABASE_URL, JWT_SECRET, EVOLUTION_API_KEY, N8N_INTERNAL_SECRET"
else
  info "backend/.env already exists"
fi

# ── Dashboard env ──────────────────────────────────────────────
section "Dashboard Configuration"

if [ ! -f "dashboard/.env.local" ]; then
  cp dashboard/.env.local.example dashboard/.env.local
  info "Created dashboard/.env.local (default: API at localhost:3001)"
else
  info "dashboard/.env.local already exists"
fi

# ── Install dependencies ───────────────────────────────────────
section "Installing Dependencies"

echo "Installing backend dependencies..."
cd backend && npm install && cd ..
info "Backend dependencies installed"

echo "Installing dashboard dependencies..."
cd dashboard && npm install && cd ..
info "Dashboard dependencies installed"

# ── Database ───────────────────────────────────────────────────
section "Database Setup"

echo "Pushing Prisma schema to PostgreSQL..."
cd backend
if npx prisma db push --accept-data-loss 2>&1; then
  info "Database schema pushed"
else
  warn "Database push failed — check DATABASE_URL in backend/.env"
fi

echo "Running seed..."
if node prisma/seed.js 2>&1; then
  info "Database seeded with demo data"
else
  warn "Seed failed — may already be seeded, or check database connection"
fi
cd ..

# ── Done ───────────────────────────────────────────────────────
section "Setup Complete!"
echo ""
echo "  Start backend:    cd backend && npm run dev"
echo "  Start dashboard:  cd dashboard && npm run dev"
echo ""
echo "  Dashboard:  http://localhost:3000"
echo "  Backend:    http://localhost:3001"
echo ""
echo "  Default login:"
echo "    Super Admin:  admin@dentaflow.com / Admin123!"
echo "    Clinic A:     clinica@dentaflow.com / Clinic123!"
echo ""
warn "Don't forget to set up your Evolution API webhook and n8n integration!"
echo "  See: README.md → Evolution API Setup"
echo "       README.md → n8n Integration"
