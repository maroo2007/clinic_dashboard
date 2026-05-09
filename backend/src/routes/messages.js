const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');
const { enforceTenancy, resolveWriteClinic } = require('../middleware/tenancy');
const { emitToClinic } = require('../services/socket');
const { sendText } = require('../services/evolution');
const { ok, created, error, paginate } = require('../utils/response');

router.use(authenticate, enforceTenancy);

// ── GET /messages ─────────────────────────────────────────
// CRITICAL: tenantFilter ensures clinics NEVER see each other's messages
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;
    const { patient_id, phone } = req.query;

    const where = {
      ...req.tenantFilter,                   // clinic isolation enforced here
      ...(patient_id && { patient_id: parseInt(patient_id) }),
      ...(phone && { phone: { contains: phone } }),
    };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          patient: { select: { id: true, name: true, phone: true } },
        },
      }),
      prisma.message.count({ where }),
    ]);

    return paginate(res, messages, total, page, limit);
  } catch (err) {
    console.error('[MESSAGES GET]', err);
    return error(res, 500, 'Failed to fetch messages');
  }
});

// ── GET /messages/conversations ───────────────────────────
// Returns last message per phone number (inbox view)
router.get('/conversations', async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: req.tenantFilter,
      distinct: ['phone'],
      orderBy: { timestamp: 'desc' },
      take: 100,
      include: {
        patient: { select: { id: true, name: true, phone: true, risk_level: true } },
      },
    });
    return ok(res, messages);
  } catch (err) {
    return error(res, 500, 'Failed to fetch conversations');
  }
});

// ── POST /messages/send ───────────────────────────────────
router.post(
  '/send',
  resolveWriteClinic,
  [
    body('to').notEmpty().withMessage('Recipient phone required'),
    body('text').notEmpty().withMessage('Message text required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return error(res, 400, errors.array()[0].msg);

    try {
      const { to, text, patient_id } = req.body;
      const normalizedPhone = to.replace(/\D/g, '').replace(/^0/, '20');

      // Send via Evolution API
      await sendText(req.resolvedClinicId, normalizedPhone, text);

      // Save outbound message to DB
      const message = await prisma.message.create({
        data: {
          clinic_id: req.resolvedClinicId,
          patient_id: patient_id ? parseInt(patient_id) : null,
          phone: normalizedPhone,
          direction: 'outbound',
          message: text,
          status: 'sent',
        },
      });

      emitToClinic(req.resolvedClinicId, 'message:new', message);
      return created(res, message, 'Message sent');
    } catch (err) {
      console.error('[MESSAGES SEND]', err);
      return error(res, 500, 'Failed to send message');
    }
  }
);

module.exports = router;
