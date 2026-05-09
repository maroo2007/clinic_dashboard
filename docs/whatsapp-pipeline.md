# DentaFlow — WhatsApp AI Pipeline

## End-to-End Message Flow

```
Patient sends WhatsApp message
           ↓
Evolution API (WhatsApp Gateway)
  POST https://your-backend.com/webhook/evolution
           ↓
Backend: /webhook/evolution
  1. Extract: phone, text, instanceName, pushName
  2. Resolve clinic from instanceName (DB lookup)
  3. Find or create patient record
  4. Save inbound message to local DB
  5. Emit message:new socket event → Dashboard updates instantly
  6. Forward to n8n with resolved_text (UTF-8 safe)
           ↓
n8n: Webhook — Clinic WhatsApp
  1. Extract & Normalize (reads resolved_text first)
  2. Valid Message? (skip fromMe, skip empty)
  3. Save Inbound to Backend (POST /internal/n8n/message)
  4. Load conversation memory from PostgreSQL (last 20 turns)
  5. Build Groq payload with:
     - Today's date + next 14-day date map
     - Available doctors list
     - Patient's known name
     - Booking rules + confirmation words
     - <<BOOKED>> check (prevents duplicate bookings)
  6. Call Groq API (llama-3.3-70b-versatile, JSON mode)
  7. Parse response: reply_message, booking_ready, booking_details
  8. Save user turn → AI turn to conversation memory
  9. Update patient_followup (sentiment, last_intent)
  10. Log to clinic_operations_log
  11. Check booking_ready (references Parse Groq Response node, not $json)
           ↓ (booking_ready = true)          ↓ (booking_ready = false)
Backend: /internal/n8n/appointment         Evolution API: send reply
  - Resolve or create patient                        ↓
  - Fuzzy-match doctor name                 Backend: /internal/n8n/message
    (Arabic احمد → 'ahmed' → Dr. Ahmed Hassan)    - Save outbound to DB
  - Create appointment                       - Emit message:new socket event
  - Emit appointment:new socket event        - Dashboard shows AI reply
  - Dashboard calendar updates instantly
           ↓
Mark Booking Done (INSERT <<BOOKED>> into memory)
  → Future turns reply: "موعدك محجوز بالفعل ✅"
           ↓
Send reply to patient via Evolution API
Route Extra Actions: escalate manager | send review link
```

## Confirmation Word Detection

The AI recognizes these as "yes, book it":

**Arabic:** ماشي / تمام / مؤكد / نعم / اه / اهه / اوكيه / اوكي / ايوه / يلا / صح / طيب / كويس / حسنا / مظبوط / موافق / عمل

**English:** yes / ok / okay / sure / confirm / confirmed / good / great / fine / perfect / go ahead / do it

## Date Resolution

The system prompt injects a 14-day date reference:

```
DATE REFERENCE:
- Saturday: 2026-05-16
- Sunday: 2026-05-17
- Monday: 2026-05-18
...
```

When patient says "السبت" (Saturday), AI maps directly to `2026-05-16`. No ambiguity.

## Encoding Safety

Arabic text is preserved through:
1. Backend extracts `text` from `req.body` (Express parses UTF-8 correctly)
2. Backend sends `resolved_text: text` to n8n with `Content-Type: application/json; charset=utf-8`
3. n8n's `Extract & Normalize` reads `body.resolved_text` before falling back to `body.data.message.conversation`
4. n8n sends UTF-8 JSON to Groq (no encoding issues)
5. Groq responds in UTF-8 JSON
6. Backend receives from n8n via HTTP, stores as-is in PostgreSQL (UTF-8)
