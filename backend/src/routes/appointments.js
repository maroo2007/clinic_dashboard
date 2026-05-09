const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');
const { enforceTenancy, resolveWriteClinic } = require('../middleware/tenancy');
const { emitToClinic } = require('../services/socket');
const { ok, created, error, paginate } = require('../utils/response');

router.use(authenticate, enforceTenancy);

// ── GET /appointments/stats ───────────────────────────────
// Returns dashboard KPIs: today's counts, totals, recent appointments
router.get('/stats', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const where = req.tenantFilter;

    const [
      todayTotal,
      todayScheduled,
      todayCompleted,
      totalPatients,
      totalMessages,
      totalDoctors,
      upcomingAppts,
    ] = await Promise.all([
      prisma.appointment.count({ where: { ...where, appointment_date: { gte: todayStart, lte: todayEnd } } }),
      prisma.appointment.count({ where: { ...where, appointment_date: { gte: todayStart, lte: todayEnd }, status: 'scheduled' } }),
      prisma.appointment.count({ where: { ...where, appointment_date: { gte: todayStart, lte: todayEnd }, status: 'completed' } }),
      prisma.patient.count({ where }),
      prisma.message.count({ where }),
      prisma.doctor.count({ where }),
      prisma.appointment.findMany({
        where: { ...where, appointment_date: { gte: todayStart, lte: todayEnd } },
        orderBy: [{ appointment_date: 'asc' }, { appointment_time: 'asc' }],
        take: 10,
        include: {
          patient: { select: { id: true, name: true, phone: true } },
          doctor: { select: { id: true, name: true } },
        },
      }),
    ]);

    return ok(res, {
      today_total: todayTotal,
      today_scheduled: todayScheduled,
      today_completed: todayCompleted,
      total_patients: totalPatients,
      total_messages: totalMessages,
      total_doctors: totalDoctors,
      today_appointments: upcomingAppts,
    });
  } catch (err) {
    console.error('[APPOINTMENTS STATS]', err);
    return error(res, 500, 'Failed to fetch stats');
  }
});

// ── GET /appointments ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const { date, status, doctor_id, from, to } = req.query;

    const where = {
      ...req.tenantFilter,
      ...(status && { status }),
      ...(doctor_id && { doctor_id: parseInt(doctor_id) }),
      ...(date && { appointment_date: new Date(date) }),
      ...(from && to && {
        appointment_date: { gte: new Date(from), lte: new Date(to) },
      }),
    };

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ appointment_date: 'asc' }, { appointment_time: 'asc' }],
        include: {
          patient: { select: { id: true, name: true, phone: true, risk_level: true } },
          doctor: { select: { id: true, name: true, specialty: true } },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    return paginate(res, appointments, total, page, limit);
  } catch (err) {
    console.error('[APPOINTMENTS GET]', err);
    return error(res, 500, 'Failed to fetch appointments');
  }
});

// ── GET /appointments/:id ─────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const appt = await prisma.appointment.findFirst({
      where: { id: parseInt(req.params.id), ...req.tenantFilter },
      include: {
        patient: { select: { id: true, name: true, phone: true, risk_level: true } },
        doctor: { select: { id: true, name: true, specialty: true } },
      },
    });
    if (!appt) return error(res, 404, 'Appointment not found');
    return ok(res, appt);
  } catch (err) {
    return error(res, 500, 'Failed to fetch appointment');
  }
});

// ── POST /appointments ────────────────────────────────────
router.post(
  '/',
  resolveWriteClinic,
  [
    body('patient_id').isInt({ min: 1 }).withMessage('Valid patient_id required'),
    body('appointment_date').isISO8601().withMessage('Valid ISO date required'),
    body('appointment_time').notEmpty().withMessage('appointment_time required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return error(res, 400, errors.array()[0].msg);

    try {
      const { patient_id, doctor_id, appointment_date, appointment_time, status, notes } = req.body;

      // Verify the patient belongs to THIS clinic — prevents cross-tenant booking
      const patient = await prisma.patient.findFirst({
        where: { id: parseInt(patient_id), clinic_id: req.resolvedClinicId },
      });
      if (!patient) return error(res, 404, 'Patient not found in this clinic');

      const appt = await prisma.appointment.create({
        data: {
          clinic_id: req.resolvedClinicId,
          patient_id: parseInt(patient_id),
          doctor_id: doctor_id ? parseInt(doctor_id) : null,
          appointment_date: new Date(appointment_date),
          appointment_time,
          status: status || 'scheduled',
          notes: notes?.trim(),
          source: 'manual',
        },
        include: {
          patient: { select: { id: true, name: true, phone: true } },
          doctor: { select: { id: true, name: true } },
        },
      });

      emitToClinic(req.resolvedClinicId, 'appointment:new', appt);
      return created(res, appt, 'Appointment created');
    } catch (err) {
      console.error('[APPOINTMENTS POST]', err);
      return error(res, 500, 'Failed to create appointment');
    }
  }
);

// ── PUT /appointments/:id ─────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.appointment.findFirst({
      where: { id: parseInt(req.params.id), ...req.tenantFilter },
    });
    if (!existing) return error(res, 404, 'Appointment not found');

    const { status, notes, appointment_date, appointment_time, doctor_id } = req.body;
    const appt = await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(appointment_date && { appointment_date: new Date(appointment_date) }),
        ...(appointment_time && { appointment_time }),
        ...(doctor_id !== undefined && {
          doctor_id: doctor_id ? parseInt(doctor_id) : null,
        }),
      },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        doctor: { select: { id: true, name: true } },
      },
    });

    emitToClinic(existing.clinic_id, 'appointment:updated', appt);
    return ok(res, appt, 'Appointment updated');
  } catch (err) {
    return error(res, 500, 'Failed to update appointment');
  }
});

// ── DELETE /appointments/:id ──────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.appointment.findFirst({
      where: { id: parseInt(req.params.id), ...req.tenantFilter },
    });
    if (!existing) return error(res, 404, 'Appointment not found');

    await prisma.appointment.delete({ where: { id: existing.id } });
    emitToClinic(existing.clinic_id, 'appointment:deleted', { id: existing.id });
    return ok(res, null, 'Appointment deleted');
  } catch (err) {
    return error(res, 500, 'Failed to delete appointment');
  }
});

module.exports = router;
