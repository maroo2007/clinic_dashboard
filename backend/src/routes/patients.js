const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');
const { enforceTenancy, resolveWriteClinic } = require('../middleware/tenancy');
const { emitToClinic } = require('../services/socket');
const { ok, created, error, paginate } = require('../utils/response');

// All patient routes require auth + tenant isolation
router.use(authenticate, enforceTenancy);

// ── GET /patients ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim();

    const where = {
      ...req.tenantFilter,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      }),
    };

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.patient.count({ where }),
    ]);

    return paginate(res, patients, total, page, limit);
  } catch (err) {
    console.error('[PATIENTS GET]', err);
    return error(res, 500, 'Failed to fetch patients');
  }
});

// ── GET /patients/:id ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { id: parseInt(req.params.id), ...req.tenantFilter },
      include: {
        appointments: {
          orderBy: { appointment_date: 'desc' },
          take: 10,
          include: { doctor: { select: { id: true, name: true } } },
        },
        messages: { orderBy: { timestamp: 'desc' }, take: 20 },
      },
    });

    if (!patient) return error(res, 404, 'Patient not found');
    return ok(res, patient);
  } catch (err) {
    return error(res, 500, 'Failed to fetch patient');
  }
});

// ── POST /patients ────────────────────────────────────────
router.post(
  '/',
  resolveWriteClinic,
  [
    body('name').trim().notEmpty().withMessage('Patient name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return error(res, 400, errors.array()[0].msg);

    try {
      const { name, phone, notes, risk_level } = req.body;
      const normalizedPhone = phone.replace(/\D/g, '').replace(/^0/, '20');

      const patient = await prisma.patient.create({
        data: {
          clinic_id: req.resolvedClinicId,    // CRITICAL: from JWT, not frontend
          name: name.trim(),
          phone: normalizedPhone,
          notes: notes?.trim(),
          risk_level: risk_level || 'low',
        },
      });

      emitToClinic(req.resolvedClinicId, 'patient:new', patient);
      return created(res, patient, 'Patient created');
    } catch (err) {
      if (err.code === 'P2002') {
        return error(res, 409, 'A patient with this phone number already exists in this clinic');
      }
      console.error('[PATIENTS POST]', err);
      return error(res, 500, 'Failed to create patient');
    }
  }
);

// ── PUT /patients/:id ─────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    // First verify this patient belongs to the requester's clinic
    const existing = await prisma.patient.findFirst({
      where: { id: parseInt(req.params.id), ...req.tenantFilter },
    });
    if (!existing) return error(res, 404, 'Patient not found');

    const { name, phone, notes, risk_level } = req.body;
    const patient = await prisma.patient.update({
      where: { id: existing.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(phone && { phone: phone.replace(/\D/g, '').replace(/^0/, '20') }),
        ...(notes !== undefined && { notes }),
        ...(risk_level && { risk_level }),
      },
    });

    emitToClinic(existing.clinic_id, 'patient:updated', patient);
    return ok(res, patient, 'Patient updated');
  } catch (err) {
    console.error('[PATIENTS PUT]', err);
    return error(res, 500, 'Failed to update patient');
  }
});

// ── DELETE /patients/:id ──────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.patient.findFirst({
      where: { id: parseInt(req.params.id), ...req.tenantFilter },
    });
    if (!existing) return error(res, 404, 'Patient not found');

    await prisma.patient.delete({ where: { id: existing.id } });
    emitToClinic(existing.clinic_id, 'patient:deleted', { id: existing.id });
    return ok(res, null, 'Patient deleted');
  } catch (err) {
    return error(res, 500, 'Failed to delete patient');
  }
});

module.exports = router;
