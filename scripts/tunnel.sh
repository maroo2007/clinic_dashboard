#!/usr/bin/env bash
# =============================================================
#  DentaFlow — Public Tunnel Script
#  Exposes the local backend (port 3001) via a public HTTPS URL
#  so that n8n (remote) can call POST /internal/n8n/*
#
#  Usage: bash scripts/tunnel.sh
#  Options:
#    TUNNEL=serveo   bash scripts/tunnel.sh   (default, no install)
#    TUNNEL=cloudflared bash scripts/tunnel.sh
# =============================================================

TUNNEL=${TUNNEL:-serveo}
BACKEND_PORT=${BACKEND_PORT:-3001}

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${GREEN}DentaFlow Public Tunnel${NC}"
echo "Backend port: $BACKEND_PORT"
echo "Tunnel type:  $TUNNEL"
echo ""

if [ "$TUNNEL" = "cloudflared" ]; then
  echo -e "${GREEN}Starting Cloudflare Tunnel...${NC}"
  echo "Tunnel URL will appear below. Copy it to:"
  echo "  1. backend/.env → BACKEND_PUBLIC_URL"
  echo "  2. n8n HTTP Request nodes: Save Inbound to Backend, Save AI Reply to Backend, Create Appointment"
  echo ""
  cloudflared tunnel --url "http://localhost:$BACKEND_PORT"

else
  # serveo.net — no installation required
  echo -e "${GREEN}Starting Serveo tunnel (ssh)...${NC}"
  echo ""
  echo -e "${YELLOW}IMPORTANT: When the URL appears, copy it and:${NC}"
  echo "  1. Update backend/.env  →  BACKEND_PUBLIC_URL=https://xxxx.serveousercontent.com"
  echo "  2. Update Evolution API webhook → bash scripts/set-evolution-webhook.sh <URL>"
  echo "  3. In n8n, update the URL in nodes:"
  echo "       - Save Inbound to Backend"
  echo "       - Save AI Reply to Backend"
  echo "       - Create Appointment"
  echo ""
  echo "NOTE: Serveo URL changes on every reconnect. Use Cloudflare Tunnel for production."
  echo ""

  # Keep-alive: reconnect on disconnect
  while true; do
    ssh -o StrictHostKeyChecking=no \
        -o ServerAliveInterval=30 \
        -o ServerAliveCountMax=3 \
        -R "80:localhost:$BACKEND_PORT" \
        serveo.net
    echo -e "${YELLOW}Tunnel disconnected. Reconnecting in 5s...${NC}"
    sleep 5
  done
fi
