# DentaFlow — Deployment Guide

## Production Deployment (Recommended Stack)

### Infrastructure

| Component | Recommended | Alternative |
|-----------|-------------|-------------|
| Backend + Dashboard | Hetzner CX21 (€5/mo) | DigitalOcean, AWS EC2 |
| Database | Supabase Free / Neon | Self-hosted PostgreSQL |
| n8n | n8n Cloud Starter ($20/mo) | Self-hosted on VPS |
| Tunnel | Cloudflare Tunnel (free) | ngrok |
| Evolution API | Dedicated VPS | Cloud provider |

---

## Step-by-Step Production Setup

### 1. Server Setup

```bash
# Update server
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com | sh
```

### 2. Clone & Configure

```bash
git clone https://github.com/maroo2007/clinic_dashboard.git /opt/dentaflow
cd /opt/dentaflow

# Configure backend
cp backend/.env.example backend/.env
nano backend/.env  # Fill in all required values

# Configure dashboard
cp dashboard/.env.local.example dashboard/.env.local
# Set NEXT_PUBLIC_API_URL to your backend's public URL
```

### 3. Database

Using Supabase (recommended):
1. Create project at supabase.com
2. Copy connection string to `DATABASE_URL` in `backend/.env`
3. Run: `cd backend && npx prisma db push && node prisma/seed.js`

### 4. Deploy with Docker

```bash
cd /opt/dentaflow
docker compose up -d --build
```

### 5. Set Up Cloudflare Tunnel

```bash
# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared-linux-amd64.deb

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create dentaflow

# Create config
cat > ~/.cloudflared/config.yml << EOF
tunnel: <your-tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:3001
  - hostname: app.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
EOF

# Start tunnel as service
cloudflared service install
systemctl start cloudflared
```

### 6. Configure Evolution API

```bash
bash scripts/set-evolution-webhook.sh https://api.yourdomain.com
```

### 7. Configure n8n

1. Import `workflows/clinic-follow-up-bot.json`
2. Add PostgreSQL credential (points to your `dental_saas` DB)
3. Replace all `${EVOLUTION_API_KEY}` → your real key
4. Replace all `${BACKEND_PUBLIC_URL}` → `https://api.yourdomain.com`
5. Replace all `${N8N_INTERNAL_SECRET}` → your secret
6. Activate workflow

---

## nginx Reverse Proxy (Optional)

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Environment Variables Checklist

Before going live, verify every variable is set:

```bash
# Check backend .env
grep -E "^(DATABASE_URL|JWT_SECRET|EVOLUTION_API_KEY|N8N_INTERNAL_SECRET|BACKEND_PUBLIC_URL)" backend/.env
```

All 5 must have real values (not the placeholder text).
