const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { ok, created, error } = require('../utils/response');

// ALL clinic management routes require SUPER_ADMIN
router.use(authenticate, requireRole('SUPER_ADMIN'));

// GET /clinics — list all clinics with stats
router.get('/', async (req, res) => {
  try {
    const clinics = await prisma.clinic.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { patients: true, appointments: true, users: true, messages: true },
        },
      },
    });
    return ok(res, clinics);
  } catch (err) {
    return error(res, 500, 'Failed to fetch clinics');
  }
});

// GET /clinics/:id
router.get('/:id', async (req, res) => {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        users: {
          select: { id: true, email: true, role: true, created_at: true },
        },
        _count: { select: { patients: true, appointments: true } },
      },
    });
    if (!clinic) return error(res, 404, 'Clinic not found');
    return ok(res, clinic);
  } catch (err) {
    return error(res, 500, 'Failed to fetch clinic');
  }
});

// POST /clinics — create new clinic + its first user
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Clinic name required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('user_password').isLength({ min: 8 }).withMessage('Password min 8 chars'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return error(res, 400, errors.array()[0].msg);

    try {
      const { name, email, phone, whatsapp_instance_name, whatsapp_api_key, user_password } = req.body;

      const clinic = await prisma.$transaction(async (tx) => {
        const newClinic = await tx.clinic.create({
          data: { name: name.trim(), email, phone, whatsapp_instance_name, whatsapp_api_key },
        });

        // Auto-create a CLINIC_USER for this clinic
        const hash = await bcrypt.hash(user_password, 10);
        await tx.user.create({
          data: {
            clinic_id: newClinic.id,
            email,
            password_hash: hash,
            role: 'CLINIC_USER',
          },
        });

        return newClinic;
      });

      return created(res, clinic, 'Clinic and user created');
    } catch (err) {
      if (err.code === 'P2002') return error(res, 409, 'Email or WhatsApp instance already in use');
      console.error('[CLINICS POST]', err);
      return error(res, 500, 'Failed to create clinic');
    }
  }
);

// PUT /clinics/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, whatsapp_instance_name, whatsapp_api_key } = req.body;
    const clinic = await prisma.clinic.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(whatsapp_instance_name !== undefined && { whatsapp_instance_name }),
        ...(whatsapp_api_key !== undefined && { whatsapp_api_key }),
      },
    });
    return ok(res, clinic, 'Clinic updated');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 404, 'Clinic not found');
    return error(res, 500, 'Failed to update clinic');
  }
});

// GET /clinics/:id/analytics
router.get('/:id/analytics', async (req, res) => {
  try {
    const clinic_id = parseInt(req.params.id);

    const [totalPatients, totalAppointments, pendingAppointments, totalMessages, recentAppointments] =
      await Promise.all([
        prisma.patient.count({ where: { clinic_id } }),
        prisma.appointment.count({ where: { clinic_id } }),
        prisma.appointment.count({ where: { clinic_id, status: 'scheduled' } }),
        prisma.message.count({ where: { clinic_id } }),
        prisma.appointment.findMany({
          where: {
            clinic_id,
            appointment_date: { gte: new Date() },
            status: 'scheduled',
          },
          orderBy: { appointment_date: 'asc' },
          take: 5,
          include: {
            patient: { select: { name: true, phone: true } },
            doctor: { select: { name: true } },
          },
        }),
      ]);

    return ok(res, {
      total_patients: totalPatients,
      total_appointments: totalAppointments,
      pending_appointments: pendingAppointments,
      total_messages: totalMessages,
      upcoming_appointments: recentAppointments,
    });
  } catch (err) {
    return error(res, 500, 'Failed to fetch analytics');
  }
});

module.exports = router;
