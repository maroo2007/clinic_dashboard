# DentaFlow — Architecture Deep Dive

## System Components

### 1. Backend (Express + Prisma)

The backend is a stateful Node.js API server. Key design decisions:

**Multi-tenancy via middleware:**
```
Request → auth middleware (JWT decode) → tenancy middleware (inject clinic_id) → route handler
```
Every route handler receives `req.clinicId` and `req.user` automatically. Prisma queries use this to filter data.

**Socket.io rooms:**
- `clinic_{id}` — staff for that clinic join this room at login
- `admin` — super admins join this AND all clinic rooms
- Events are emitted with `emitToClinic(cid, event, data)` which sends to both `clinic_{cid}` and `admin`

**Internal API (n8n bridge):**
The `/internal/n8n/*` routes are protected by `X-N8N-Secret` header. n8n calls these to:
- `POST /internal/n8n/message` — save a WhatsApp message + emit `message:new`
- `POST /internal/n8n/appointment` — create appointment + emit `appointment:new`
- `POST /internal/n8n/event` — emit any socket event
- `POST /internal/n8n/log` — write audit log

### 2. n8n Workflow Engine

n8n runs the entire AI logic. This keeps LLM code out of the backend:

```
Webhook (Evolution payload)
  ↓
Extract & Normalize (Code node)
  — reads body.resolved_text (UTF-8 safe) or body.data.message.conversation
  ↓
Valid Message? (IF: !fromMe && message not empty)
  ↓ (true)
Save Inbound to Backend (HTTP → /internal/n8n/message, direction=inbound)
  ↓
Load Memory + Profile (Postgres — conversation_memory + patient_followup)
  ↓
Build Groq Payload (Code node)
  — injects: today's date, next 14 days date map, clinic name, known patient name
  — system prompt with booking rules, confirmation word list, <<BOOKED>> detection
  ↓
Groq AI (HTTP → api.groq.com, llama-3.3-70b-versatile)
  ↓
Parse Groq Response (Code node)
  — extracts: reply_message, booking_ready, booking_details, sentiment, intent
  ↓
Save User Turn → Save AI Turn (Postgres — conversation_memory)
  ↓
Update Patient Record → Log to Operations (Postgres)
  ↓
Booking Ready? (IF: $('Parse Groq Response').first().json.booking_ready === true)
  ↓ (true)                              ↓ (false)
Create Appointment (HTTP →             Send Patient Reply (HTTP → Evolution API)
  /internal/n8n/appointment)
  ↓
Mark Booking Done (Postgres — INSERT <<BOOKED>> into conversation_memory)
  ↓
Send Patient Reply → Save AI Reply to Backend → Route Extra Actions
```

### 3. Encoding & UTF-8 Flow

Arabic text must be preserved end-to-end:

```
Evolution API (Linux) → UTF-8 JSON POST → Serveo/Cloudflare Tunnel
  → backend /webhook/evolution (Express json() parses UTF-8 correctly)
  → forwardToN8n() uses JSON.stringify() + Content-Type: application/json; charset=utf-8
  → n8n receives UTF-8 body
  → Extract & Normalize reads body.resolved_text (pre-extracted by backend)
     (not body.data.message.conversation which may be corrupted in transit)
```

**Why `resolved_text`?** The backend extracts `text` from `req.body` BEFORE forwarding, and injects it as `resolved_text`. n8n's `Extract & Normalize` reads this field first, bypassing any tunnel encoding corruption.

### 4. Dashboard State Architecture

```
Login → POST /auth/login → JWT stored in:
  - localStorage['token'] (API calls)
  - document.cookie['auth_token'] (server-side route protection via proxy.ts)

Zustand auth store:
  setAuth(user, token) → sets both localStorage and cookie
  clearAuth() → removes both

Socket.io lifecycle:
  1. Layout component mounts → initSocket(token)
  2. Socket authenticates with JWT in auth.token
  3. Emits 'join:clinic' with clinic_id
  4. Pages subscribe to events in useEffect, unsubscribe on unmount
```

### 5. Booking Flow State Machine

The AI tracks booking state through conversation memory:

```
State: idle
  Patient: "عايز احجز موعد"
  AI asks: name?
  State: collecting_name

State: collecting_name
  Patient: "مصطفى سكر"
  AI asks: date? (with DATE REFERENCE showing exact YYYY-MM-DD)
  State: collecting_date

State: collecting_date
  Patient: "الخميس" (Thursday)
  AI resolves: Thursday = 2026-05-21 (from DATE REFERENCE)
  AI asks: time?
  State: collecting_time

... (collecting_time → collecting_doctor → confirming)

State: confirming
  AI shows: "مصطفى / 2026-05-21 / 11:00 / Dr. Ahmed Hassan. ماشي؟"
  Patient: "ماشي" (any of 30+ confirmation words)
  AI sets: booking_ready=true, booking_details={...}
  n8n → Create Appointment → Mark Booking Done (<<BOOKED>> in memory)
  State: booked

State: booked
  Patient: "شكرا"
  AI reads <<BOOKED>> in history → replies: "موعدك محجوز بالفعل ✅"
  booking_ready=false (no duplicate creation)
```
