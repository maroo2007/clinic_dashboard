const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');
const { enforceTenancy, resolveWriteClinic } = require('../middleware/tenancy');
const { ok, created, error } = require('../utils/response');

router.use(authenticate, enforceTenancy);

// GET /doctors
router.get('/', async (req, res) => {
  try {
    const doctors = await prisma.doctor.findMany({
      where: req.tenantFilter,
      orderBy: { name: 'asc' },
    });
    return ok(res, doctors);
  } catch (err) {
    return error(res, 500, 'Failed to fetch doctors');
  }
});

// POST /doctors
router.post(
  '/',
  resolveWriteClinic,
  [body('name').trim().notEmpty().withMessage('Doctor name required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return error(res, 400, errors.array()[0].msg);

    try {
      const { name, specialty, schedule } = req.body;
      const doctor = await prisma.doctor.create({
        data: {
          clinic_id: req.resolvedClinicId,
          name: name.trim(),
          specialty: specialty?.trim(),
          schedule: schedule || null,
        },
      });
      return created(res, doctor, 'Doctor created');
    } catch (err) {
      return error(res, 500, 'Failed to create doctor');
    }
  }
);

// PUT /doctors/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.doctor.findFirst({
      where: { id: parseInt(req.params.id), ...req.tenantFilter },
    });
    if (!existing) return error(res, 404, 'Doctor not found');

    const { name, specialty, schedule } = req.body;
    const doctor = await prisma.doctor.update({
      where: { id: existing.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(specialty !== undefined && { specialty }),
        ...(schedule !== undefined && { schedule }),
      },
    });
    return ok(res, doctor, 'Doctor updated');
  } catch (err) {
    return error(res, 500, 'Failed to update doctor');
  }
});

// DELETE /doctors/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.doctor.findFirst({
      where: { id: parseInt(req.params.id), ...req.tenantFilter },
    });
    if (!existing) return error(res, 404, 'Doctor not found');
    await prisma.doctor.delete({ where: { id: existing.id } });
    return ok(res, null, 'Doctor deleted');
  } catch (err) {
    return error(res, 500, 'Failed to delete doctor');
  }
});

module.exports = router;
