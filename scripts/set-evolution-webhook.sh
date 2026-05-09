#!/usr/bin/env bash
# =============================================================
#  Set Evolution API Webhook URL
#  Usage: bash scripts/set-evolution-webhook.sh https://xxxx.serveousercontent.com
# =============================================================

PUBLIC_URL=${1:-$BACKEND_PUBLIC_URL}

if [ -z "$PUBLIC_URL" ]; then
  echo "Usage: bash scripts/set-evolution-webhook.sh <PUBLIC_URL>"
  echo "Example: bash scripts/set-evolution-webhook.sh https://abc123.serveousercontent.com"
  exit 1
fi

# Load from .env if not set
if [ -z "$EVOLUTION_API_BASE_URL" ] || [ -z "$EVOLUTION_API_KEY" ] || [ -z "$DEFAULT_WA_INSTANCE" ]; then
  if [ -f "backend/.env" ]; then
    export $(grep -v '^#' backend/.env | xargs)
  fi
fi

WEBHOOK_URL="${PUBLIC_URL}/webhook/evolution"
INSTANCE="${DEFAULT_WA_INSTANCE}"

echo "Setting Evolution API webhook..."
echo "  Instance: $INSTANCE"
echo "  Webhook:  $WEBHOOK_URL"
echo ""

curl -s -X POST "${EVOLUTION_API_BASE_URL}/webhook/set/$(python3 -c "import urllib.parse; print(urllib.parse.quote('$INSTANCE'))" 2>/dev/null || echo "$INSTANCE")" \
  -H "apikey: ${EVOLUTION_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"webhook\": {
      \"enabled\": true,
      \"url\": \"${WEBHOOK_URL}\",
      \"webhookByEvents\": false,
      \"webhookBase64\": false,
      \"events\": [\"MESSAGES_UPSERT\"]
    }
  }" | python3 -m json.tool 2>/dev/null || echo "Done (check output above)"
