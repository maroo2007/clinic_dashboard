const router = require('express').Router();
const axios = require('axios');
const prisma = require('../config/prisma');
const { resolveClinicFromInstance } = require('../services/evolution');
const { emitToClinic } = require('../services/socket');
const { webhookLimiter } = require('../middleware/rateLimit');

router.use(webhookLimiter);

/**
 * POST /webhook/evolution
 * ─────────────────────────────────────────────────────────
 * Receives ALL events from Evolution API (WhatsApp).
 *
 * Configure your Evolution API instance to send webhooks to:
 *   http://YOUR_BACKEND_HOST/webhook/evolution
 *
 * This handler:
 *  1. Responds 200 immediately (prevents Evolution API retries)
 *  2. Resolves clinic_id from instance name
 *  3. Auto-creates patient if new
 *  4. Saves inbound message to DB
 *  5. Emits real-time socket event to clinic dashboard
 *  6. Forwards enriched payload to n8n MASTER ROUTER for AI processing
 */
router.post('/evolution', async (req, res) => {
  // Respond immediately — never hold Evolution API waiting
  res.status(200).json({ status: 'ok' });

  const payload = req.body;

  try {
    const event = payload.event || payload.type || '';
    const instanceName = payload.instance || payload.instanceName || '';

    // Only process inbound message events
    if (!event.includes('message')) return;

    const key = payload.data?.key || {};
    // Skip messages sent by the bot itself
    if (key.fromMe === true) return;

    // ── Resolve clinic ─────────────────────────────────────
    const clinic_id = await resolveClinicFromInstance(instanceName);
    if (!clinic_id) {
      console.warn(`[WEBHOOK] Unregistered Evolution instance: "${instanceName}" — ignoring`);
      return;
    }

    // ── Extract message data ───────────────────────────────
    const data = payload.data || {};
    const msgObj = data.message || {};
    const rawJid = key.remoteJid || '';
    const rawPhone = rawJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    const phone = rawPhone.replace(/\D/g, '').replace(/^0/, '20');
    const text =
      msgObj.conversation ||
      msgObj.extendedTextMessage?.text ||
      msgObj.imageMessage?.caption ||
      msgObj.videoMessage?.caption ||
      '';
    const pushName = data.pushName || '';

    if (!phone || !text) return;

    // ── Find or create patient ─────────────────────────────
    let patient = await prisma.patient.findFirst({ where: { clinic_id, phone } });

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          clinic_id,
          phone,
          name: pushName || phone,
          risk_level: 'low',
        },
      });
      console.log(`[WEBHOOK] New patient created — clinic ${clinic_id}, phone ${phone}`);
      emitToClinic(clinic_id, 'patient:new', patient);
    }

    // ── Save inbound message ───────────────────────────────
    const savedMessage = await prisma.message.create({
      data: {
        clinic_id,
        patient_id: patient.id,
        phone,
        direction: 'inbound',
        message: text,
        status: 'received',
      },
    });

    // ── Emit to clinic dashboard ───────────────────────────
    emitToClinic(clinic_id, 'message:new', {
      ...savedMessage,
      patient: { id: patient.id, name: patient.name, phone: patient.phone },
    });

    // ── Forward to n8n MASTER ROUTER ──────────────────────
    if (process.env.N8N_MASTER_ROUTER_URL) {
      forwardToN8n(clinic_id, patient, payload, text, phone).catch((err) =>
        console.warn('[WEBHOOK] n8n forward failed:', err.message)
      );
    }
  } catch (err) {
    console.error('[WEBHOOK] Processing error:', err.message, err.stack);
  }
});

/**
 * Forward the enriched event to n8n MASTER ROUTER.
 * Non-blocking — failures are logged but don't affect the webhook response.
 */
async function forwardToN8n(clinic_id, patient, originalPayload, text, phone) {
  const body = JSON.stringify({
    ...originalPayload,
    clinic_id,
    patient_id: patient.id,
    patient_name: patient.name,
    resolved_phone: phone,
    resolved_text: text,
    _source: 'backend_webhook',
  });
  await axios.post(
    process.env.N8N_MASTER_ROUTER_URL,
    body,
    {
      timeout: 8000,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }
  );
}

/**
 * GET /webhook/evolution/test
 * Health check — confirm the webhook endpoint is reachable.
 */
router.get('/evolution/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Evolution API webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
