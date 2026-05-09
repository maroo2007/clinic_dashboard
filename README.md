<![CDATA[# DentaFlow — AI-Powered Multi-Tenant Clinic SaaS

<div align="center">

![DentaFlow](https://img.shields.io/badge/DentaFlow-1.0.0-blue?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-20-green?style=for-the-badge&logo=node.js)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=for-the-badge&logo=postgresql)
![Socket.io](https://img.shields.io/badge/Socket.io-4.8-white?style=for-the-badge&logo=socket.io)

**A production-grade, multi-tenant dental clinic management platform with an AI WhatsApp receptionist, real-time appointment calendar, and n8n automation backbone.**

</div>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Monorepo Structure](#monorepo-structure)
- [Quick Start](#quick-start)
- [Docker Setup](#docker-setup)
- [Manual Setup](#manual-setup)
- [Environment Variables](#environment-variables)
- [n8n Integration](#n8n-integration)
- [Evolution API (WhatsApp)](#evolution-api-whatsapp)
- [Socket.io Real-Time Architecture](#socketio-real-time-architecture)
- [Multi-Tenancy & RBAC](#multi-tenancy--rbac)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Deployment](#deployment)

---

## Overview

DentaFlow is a complete SaaS platform built for dental clinic chains. It provides:

- **AI WhatsApp Receptionist** — Patients message a WhatsApp number and the AI books appointments, answers questions, and escalates complaints — all without human intervention.
- **Real-Time Dashboard** — Clinic staff see new messages, appointments, and patient activity the instant they happen via Socket.io.
- **Multi-Tenant Architecture** — Each clinic has isolated data. A single deployment serves unlimited clinics.
- **n8n Automation** — All AI orchestration, database memory, and Groq LLM calls run in n8n — no LLM code in the backend.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PATIENT                                   │
│                  (WhatsApp Message)                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              EVOLUTION API (WhatsApp Gateway)                    │
│           Hosted at: your-evolution-server:8080                  │
│    Webhook → POST /webhook/evolution  (via public tunnel)        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DENTAFLOW BACKEND (Node.js)                     │
│                     Port 3001                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  REST API   │  │  Socket.io   │  │  Webhook Ingress      │  │
│  │  /auth      │  │  Rooms:      │  │  /webhook/evolution   │  │
│  │  /appts     │  │  clinic_{id} │  │  → forward to n8n     │  │
│  │  /patients  │  │  admin       │  │                       │  │
│  │  /messages  │  └──────────────┘  └───────────────────────┘  │
│  │  /doctors   │                                                 │
│  │  /internal  │ ← n8n calls back here to save messages/appts   │
│  └─────────────┘                                                 │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────┐                                                 │
│  │   Prisma    │                                                 │
│  │    ORM      │                                                 │
│  └──────┬──────┘                                                 │
└─────────┼───────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                           │
│               dental_saas schema                                │
│  clinics │ patients │ appointments │ messages │ doctors │ users  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    n8n Automation Engine                         │
│              https://your-n8n.example.com                       │
│                                                                  │
│  Webhook → Extract → AI Memory → Groq LLM → Parse →             │
│  DB Save → Booking? → Create Appt → Send Reply → Backend Bridge │
│                                                                  │
│  PostgreSQL (remote): conversation_memory, patient_followup      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│               DENTAFLOW DASHBOARD (Next.js 16)                  │
│                       Port 3000                                  │
│  Login → JWT → Socket.io join clinic_{id} room                  │
│  Pages: Overview │ Appointments │ Messages │ Patients │ Doctors  │
│  Real-time: appointment:new, message:new, patient:new           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Real-Time | Socket.io 4.8 |
| Auth | JWT (jsonwebtoken) |
| Rate Limiting | express-rate-limit |
| Validation | express-validator |
| Security | helmet, cors |
| WhatsApp | Evolution API v2 |

### Dashboard
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 |
| HTTP | Axios |
| Real-Time | Socket.io-client 4.8 |
| Charts | Recharts |
| Icons | Lucide React |
| Toasts | Sonner |

### Automation
| Layer | Technology |
|-------|-----------|
| Workflow Engine | n8n (self-hosted) |
| AI Model | Groq — Llama 3.3 70B |
| Memory | PostgreSQL (via n8n credentials) |
| WhatsApp Send | Evolution API HTTP nodes |

---

## Features

### AI WhatsApp Receptionist
- Converses with patients in Arabic, English, or Arabizi
- Books appointments through multi-turn conversation (Name → Date → Time → Doctor → Confirm)
- Resolves day names ("Thursday") to exact dates automatically
- Recognizes 30+ confirmation words in Arabic and English
- Marks booking complete (`<<BOOKED>>`) to prevent repeat confirmations
- Escalates complaints to clinic manager via WhatsApp alert
- Sends Google review links for happy patients

### Real-Time Dashboard
- Live appointment calendar with WhatsApp-sourced bookings highlighted (⚡)
- Instant message feed with patient conversation history
- Patient auto-created on first message
- Socket.io events: `appointment:new`, `message:new`, `patient:new`
- Multi-view: calendar grid + list view

### Multi-Tenant CRM
- Each clinic has isolated patients, appointments, messages, doctors
- RBAC: `SUPER_ADMIN` sees all clinics, `CLINIC_USER` sees only their clinic
- Per-clinic WhatsApp instance configuration

---

## Monorepo Structure

```
dentaflow/
├── backend/                    # Express + Prisma API server
│   ├── src/
│   │   ├── config/             # Prisma client singleton
│   │   ├── middleware/         # auth, rateLimit, tenancy
│   │   ├── routes/             # appointments, auth, doctors, internal, messages, patients, webhook
│   │   ├── services/           # evolution (WhatsApp), socket (Socket.io)
│   │   └── utils/              # jwt helpers, response formatters
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (source of truth)
│   │   └── seed.js             # Initial demo data seeder
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── dashboard/                  # Next.js 16 clinic dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/
│   │   │   │   ├── appointments/page.tsx   # Calendar + booking mgmt
│   │   │   │   ├── messages/page.tsx       # WhatsApp conversation view
│   │   │   │   ├── patients/page.tsx       # Patient CRM
│   │   │   │   ├── doctors/page.tsx        # Doctor management
│   │   │   │   ├── clinics/page.tsx        # Admin: clinic overview
│   │   │   │   └── layout.tsx             # Sidebar + socket init
│   │   │   └── login/page.tsx
│   │   ├── lib/
│   │   │   ├── api.ts          # Axios instance (JWT auto-attach)
│   │   │   ├── socket.ts       # Socket.io singleton
│   │   │   ├── types.ts        # TypeScript interfaces
│   │   │   └── utils.ts        # formatTime, cn helpers
│   │   ├── store/
│   │   │   └── auth.ts         # Zustand auth store (JWT + cookie)
│   │   └── proxy.ts            # Next.js 16 route middleware
│   ├── Dockerfile
│   ├── package.json
│   └── .env.local.example
│
├── workflows/                  # n8n workflow exports (import via n8n UI)
│   └── clinic-follow-up-bot.json    # AI Reply Handler (23 nodes)
│
├── docs/                       # Architecture documentation
│   ├── architecture.md
│   ├── whatsapp-pipeline.md
│   └── deployment.md
│
├── scripts/                    # Setup and utility scripts
│   ├── setup.sh                # First-time setup wizard
│   ├── tunnel.sh               # Start public tunnel (serveo/cloudflared)
│   └── seed-demo.sql           # Demo data SQL
│
├── docker-compose.yml          # Full stack: postgres, redis, backend, dashboard, n8n
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Docker + Docker Compose (optional but recommended)
- An [Evolution API](https://github.com/EvolutionAPI/evolution-api) instance with a connected WhatsApp number
- A self-hosted [n8n](https://n8n.io) instance (or n8n Cloud)
- A [Groq API key](https://console.groq.com) (free tier works)

---

## Docker Setup

The fastest way to run the full stack:

```bash
git clone https://github.com/maroo2007/clinic_dashboard.git dentaflow
cd dentaflow

# 1. Configure backend secrets
cp backend/.env.example backend/.env
# Edit backend/.env with your real values

# 2. Configure dashboard
cp dashboard/.env.local.example dashboard/.env.local
# Edit dashboard/.env.local if your backend runs on a different host

# 3. Start everything
docker compose up -d

# 4. Run database migrations + seed
docker compose exec backend npx prisma db push
docker compose exec backend node prisma/seed.js
```

Services will be available at:
| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| n8n | http://localhost:5678 |
| PostgreSQL | localhost:5432 |

---

## Manual Setup

### 1. PostgreSQL

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE dental_saas;"
```

### 2. Backend

```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, etc.

# Push schema to database
npm run db:push

# Seed demo data
npm run seed

# Start development server
npm run dev
```

### 3. Dashboard

```bash
cd dashboard
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_URL=http://localhost:3001

# Start development server (Turbopack disabled for Windows compatibility)
npm run dev
```

Dashboard runs at http://localhost:3000

### Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@dentaflow.com | Admin123! |
| Clinic A | clinica@dentaflow.com | Clinic123! |
| Clinic B | clinicb@dentaflow.com | Clinic123! |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Server port (default: 3001) |
| `NODE_ENV` | Yes | `development` or `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Min 32 chars, random secret |
| `JWT_EXPIRES_IN` | Yes | Token expiry (e.g. `24h`) |
| `FRONTEND_URL` | Yes | CORS allowed origin |
| `EVOLUTION_API_BASE_URL` | Yes | Your Evolution API server URL |
| `EVOLUTION_API_KEY` | Yes | Evolution API global key |
| `DEFAULT_WA_INSTANCE` | Yes | Default WhatsApp instance name |
| `N8N_MASTER_ROUTER_URL` | Yes | n8n webhook URL for incoming WhatsApp |
| `N8N_INTERNAL_SECRET` | Yes | Shared secret for n8n→backend calls |
| `BACKEND_PUBLIC_URL` | Yes | Public URL n8n uses to call back to backend |

### Dashboard (`dashboard/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL |
| `NEXT_PUBLIC_WS_URL` | Yes | Socket.io server URL |

---

## n8n Integration

### Import the Workflow

1. Open your n8n instance
2. Go to **Workflows → Import from File**
3. Import `workflows/clinic-follow-up-bot.json`
4. Configure credentials:
   - **Clinic PostgreSQL**: Add a PostgreSQL credential pointing to your `dental_saas` database
   - Update all HTTP Request nodes with your real `${EVOLUTION_API_KEY}` and `${BACKEND_PUBLIC_URL}`
5. Activate the workflow

### Workflow: Clinic Follow-Up Bot (23 nodes)

```
Webhook → Respond 200 → Extract & Normalize → Valid Message?
  └─(valid)→ Save Inbound to Backend → Load Memory + Profile
              → Build Groq Payload → Groq AI → Parse Groq Response
              → Save User Turn → Save AI Turn → Update Patient
              → Log to Operations → Booking Ready?
                ├─(yes)→ Create Appointment → Mark Booking Done → Send Reply
                └─(no) → Send Reply
                          → Save AI Reply to Backend
                          → Route Extra Actions (escalate / review / done)
```

### Backend Public URL (Tunnel)

When n8n is hosted remotely, it needs a public URL to call `POST /internal/n8n/message` and `POST /internal/n8n/appointment`.

**Development (serveo.net):**
```bash
# Run once — note the assigned URL
bash scripts/tunnel.sh

# Update BACKEND_PUBLIC_URL in backend/.env with the serveo URL
# Update n8n HTTP Request nodes with the new URL
```

**Production (Cloudflare Tunnel — recommended):**
```bash
cloudflared tunnel --url http://localhost:3001
```

---

## Evolution API (WhatsApp)

1. Deploy [Evolution API](https://github.com/EvolutionAPI/evolution-api)
2. Create an instance and connect WhatsApp
3. Set the webhook URL:

```bash
curl -X POST "http://your-evolution-server:8080/webhook/set/YOUR_INSTANCE" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "https://YOUR_BACKEND_PUBLIC_URL/webhook/evolution",
      "webhookByEvents": false,
      "webhookBase64": false,
      "events": ["MESSAGES_UPSERT"]
    }
  }'
```

4. Update `EVOLUTION_API_BASE_URL`, `EVOLUTION_API_KEY`, and `DEFAULT_WA_INSTANCE` in `backend/.env`

---

## Socket.io Real-Time Architecture

### Rooms

| Room | Who joins | Events received |
|------|-----------|-----------------|
| `clinic_{id}` | Clinic staff with `clinic_id` | `appointment:new`, `message:new`, `patient:new` |
| `admin` | `SUPER_ADMIN` users | All clinic events |

### Client Setup

```typescript
// After login, join your clinic room
socket.emit('join:clinic', { clinic_id: user.clinic_id });

// Listen for real-time events
socket.on('appointment:new', (appt) => { /* add to calendar */ });
socket.on('message:new', (msg) => { /* prepend to conversation */ });
socket.on('patient:new', (patient) => { /* update patient list */ });
```

### Event Emitters

Events are emitted by the backend from:
- `POST /webhook/evolution` — inbound WhatsApp message
- `POST /internal/n8n/message` — AI reply saved
- `POST /internal/n8n/appointment` — appointment created from WhatsApp

---

## Multi-Tenancy & RBAC

### Tenant Isolation

Every database record includes `clinic_id`. The `tenancy` middleware:
1. Reads `clinic_id` from the authenticated JWT token
2. Injects it into every Prisma query via `req.clinicFilter`
3. Prevents cross-tenant data access at the middleware layer

### Roles

| Role | Access |
|------|--------|
| `SUPER_ADMIN` | All clinics, all data, admin endpoints |
| `CLINIC_USER` | Own clinic only, no admin endpoints |

### Per-Clinic WhatsApp

Each clinic can have its own Evolution API instance:
- `clinics.whatsapp_instance_name` — Evolution instance name
- `clinics.whatsapp_api_key` — Per-clinic API key (falls back to global)

---

## API Reference

### Authentication
```
POST /auth/login          { email, password } → { token, user }
GET  /auth/me             → current user
```

### Appointments
```
GET    /appointments                  List (with date range filters)
POST   /appointments                  Create
PUT    /appointments/:id              Update
DELETE /appointments/:id              Delete
GET    /appointments/stats            Dashboard KPIs
```

### Messages
```
GET  /messages                        List conversations
GET  /messages/:phone                 Message thread for phone
```

### Patients
```
GET  /patients                        List
POST /patients                        Create
PUT  /patients/:id                    Update
```

### n8n Internal (protected by X-N8N-Secret)
```
POST /internal/n8n/message            Save message + emit socket event
POST /internal/n8n/appointment        Create appointment + emit socket event
POST /internal/n8n/event              Emit arbitrary socket event
POST /internal/n8n/log                Write to audit log
```

### Webhooks
```
POST /webhook/evolution               Evolution API inbound messages
GET  /webhook/evolution/test          Health check
```

---

## Troubleshooting

### PostgreSQL won't start (Windows)

```bash
# Check for stale PID file
del "C:\Program Files\PostgreSQL\17\data\postmaster.pid"

# Start service
& "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" start `
  -D "C:\Program Files\PostgreSQL\17\data" -l logfile -w
```

### Next.js crashes with "os error 1450 Insufficient system resources"

Turbopack has issues on Windows. The `dev` script already disables it:
```json
"dev": "next dev --webpack"
```

### Auth rate limiting blocks login during testing

The rate limiter allows 100 req/15min in `NODE_ENV=development`. Restart the backend to reset counters.

### n8n can't reach the backend (`ECONNREFUSED`)

n8n is on a remote server — `localhost` doesn't reach your machine. Set up a public tunnel:
```bash
bash scripts/tunnel.sh
```
Then update `BACKEND_PUBLIC_URL` in `.env` and the n8n HTTP Request node URLs.

### Arabic text stored as `????` in database

Ensure `Content-Type: application/json; charset=utf-8` is set on all HTTP requests to n8n. The backend's `forwardToN8n` function handles this automatically. Direct bash curl on Windows may corrupt non-ASCII — use Node.js scripts for testing.

---

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `JWT_SECRET` (32+ random chars)
- [ ] Set `N8N_INTERNAL_SECRET` to a strong random value
- [ ] Use environment variables — never commit `.env`
- [ ] Set up Cloudflare Tunnel for permanent `BACKEND_PUBLIC_URL`
- [ ] Configure Evolution API webhook to use production backend URL
- [ ] Import n8n workflow JSON and activate
- [ ] Run `npx prisma db push` on production database
- [ ] Run `node prisma/seed.js` once for initial data

### Recommended Stack
- **Backend + Dashboard**: Any VPS (DigitalOcean, Hetzner, AWS EC2)
- **Database**: Managed PostgreSQL (Supabase, Neon, RDS)
- **n8n**: n8n Cloud or self-hosted with Docker
- **Tunnel**: Cloudflare Tunnel (free, permanent, no URL changes)
- **Evolution API**: Dedicated VPS (needs stable WhatsApp connection)

---

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">
Built with care for dental clinics everywhere.
</div>
]]>
