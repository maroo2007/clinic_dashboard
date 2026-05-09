const router = require('express').Router();
const prisma = require('../config/prisma');
const { emitToClinic } = require('../services/socket');
const { ok, created, error } = require('../utils/response');

/**
 * INTERNAL — n8n → Backend bridge
 * ─────────────────────────────────────────────────────────
 * These routes are called by the n8n MASTER ROUTER to:
 *   • Create appointments detected from WhatsApp bookings
 *   • Emit real-time socket events
 *   • Write automation logs
 *
 * Protected by a shared secret header: X-N8N-Secret
 * Set N8N_INTERNAL_SECRET in .env and the same value in n8n HTTP headers.
 *
 * n8n HTTP Request node config:
 *   URL: http://YOUR_BACKEND/internal/n8n/appointment
 *   Method: POST
 *   Headers: { "X-N8N-Secret": "{{your_secret}}", "Content-Type": "application/json" }
 */

function verifyN8nSecret(req, res, next) {
  const incoming = req.headers['x-n8n-secret'];
  const expected = process.env.N8N_INTERNAL_SECRET;

  if (!expected) {
    console.warn('[INTERNAL] N8N_INTERNAL_SECRET not set — rejecting request');
    return res.status(503).json({ error: 'Internal endpoint not configured' });
  }
  if (!incoming || incoming !== expected) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(verifyN8nSecret);

// ── POST /internal/n8n/appointment ────────────────────────
/**
 * n8n calls this when it detects a booking intent in a WhatsApp conversation.
 *
 * Body: {
 *   clinic_id, patient_phone, patient_name,
 *   doctor_name, appointment_date, appointment_time, notes
 * }
 */
router.post('/n8n/appointment', async (req, res) => {
  try {
    const {
      clinic_id,
      patient_phone,
      patient_name,
      doctor_name,
      appointment_date,
      appointment_time,
      notes,
    } = req.body;

    if (!clinic_id) return error(res, 400, 'clinic_id required');

    const cid = parseInt(clinic_id);

    // ── Resolve or create patient ─────────────────────────
    let patient = null;

    if (patient_phone) {
      const normalizedPhone = patient_phone.replace(/\D/g, '').replace(/^0/, '20');
      patient = await prisma.patient.findFirst({
        where: { clinic_id: cid, phone: normalizedPhone },
      });

      if (!patient) {
        patient = await prisma.patient.create({
          data: {
            clinic_id: cid,
            phone: normalizedPhone,
            name: patient_name || normalizedPhone,
          },
        });
        emitToClinic(cid, 'patient:new', patient);
      }
    }

    // ── Resolve doctor (flexible: English full name, first name, or Arabic keyword) ─
    let doctor = null;
    if (doctor_name) {
      const arabicToEnglish = { 'احمد': 'ahmed', 'حسن': 'hassan', 'منى': 'mona', 'فتحي': 'fathy', 'مني': 'mona' };
      let searchTerm = doctor_name;
      for (const [ar, en] of Object.entries(arabicToEnglish)) {
        if (doctor_name.includes(ar)) { searchTerm = en; break; }
      }
      doctor = await prisma.doctor.findFirst({
        where: { clinic_id: cid, name: { contains: searchTerm, mode: 'insensitive' } },
      });
      // fallback: try each word in the provided name
      if (!doctor) {
        const words = doctor_name.split(/\s+/);
        for (const word of words) {
          if (word.length < 3) continue;
          doctor = await prisma.doctor.findFirst({
            where: { clinic_id: cid, name: { contains: word, mode: 'insensitive' } },
          });
          if (doctor) break;
        }
      }
    }

    // ── Create appointment ────────────────────────────────
    const appt = await prisma.appointment.create({
      data: {
        clinic_id: cid,
        patient_id: patient?.id ?? null,
        doctor_id: doctor?.id ?? null,
        appointment_date: appointment_date ? new Date(appointment_date) : new Date(),
        appointment_time: appointment_time || 'TBD',
        status: 'scheduled',
        notes: notes?.trim(),
        source: 'whatsapp',        // marks this as a WhatsApp-originated booking
      },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        doctor: { select: { id: true, name: true } },
      },
    });

    // ── Push to dashboard instantly ───────────────────────
    emitToClinic(cid, 'appointment:new', appt);

    console.log(`[INTERNAL] Appointment created via n8n — clinic ${cid}, id ${appt.id}`);
    return created(res, appt, 'Appointment created from n8n');
  } catch (err) {
    console.error('[INTERNAL] appointment:', err);
    return error(res, 500, 'Failed to create appointment');
  }
});

// ── POST /internal/n8n/event ──────────────────────────────
/**
 * Generic socket event emitter — n8n can push any real-time update.
 *
 * Body: { clinic_id, event, data }
 */
router.post('/n8n/event', (req, res) => {
  const { clinic_id, event, data } = req.body;
  if (!clinic_id || !event) return error(res, 400, 'clinic_id and event required');

  emitToClinic(parseInt(clinic_id), event, data || {});
  return ok(res, null, `Event "${event}" emitted to clinic ${clinic_id}`);
});

// ── POST /internal/n8n/log ────────────────────────────────
/**
 * n8n logs automation events here for the audit trail.
 */
router.post('/n8n/log', async (req, res) => {
  try {
    const { clinic_id, event_type, phone, workflow, result, error: errMsg } = req.body;

    await prisma.automationLog.create({
      data: {
        clinic_id: clinic_id ? parseInt(clinic_id) : null,
        event_type: event_type || 'unknown',
        phone,
        workflow,
        result,
        error: errMsg,
      },
    });

    return ok(res, null, 'Logged');
  } catch (err) {
    console.error('[INTERNAL] log:', err);
    return error(res, 500, 'Failed to write log');
  }
});

// ── POST /internal/n8n/message ────────────────────────────
/**
 * n8n calls this after sending a WhatsApp message so it appears in the dashboard.
 */
router.post('/n8n/message', async (req, res) => {
  try {
    const { clinic_id, patient_phone, text, direction = 'outbound' } = req.body;
    if (!clinic_id || !text) return error(res, 400, 'clinic_id and text required');

    const cid = parseInt(clinic_id);
    const normalizedPhone = patient_phone?.replace(/\D/g, '').replace(/^0/, '20');

    const patient = normalizedPhone
      ? await prisma.patient.findFirst({ where: { clinic_id: cid, phone: normalizedPhone } })
      : null;

    const message = await prisma.message.create({
      data: {
        clinic_id: cid,
        patient_id: patient?.id ?? null,
        phone: normalizedPhone,
        direction,
        message: text,
        status: direction === 'outbound' ? 'sent' : 'received',
      },
    });

    emitToClinic(cid, 'message:new', message);
    return created(res, message, 'Message saved');
  } catch (err) {
    return error(res, 500, 'Failed to save message');
  }
});

module.exports = router;
