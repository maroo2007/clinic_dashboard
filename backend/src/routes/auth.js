const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/prisma');
const { signToken } = require('../utils/jwt');
const { ok, error } = require('../utils/response');

/**
 * POST /auth/login
 * Returns JWT containing { id, role, clinic_id }
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required').customSanitizer(v => v.toLowerCase()),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return error(res, 400, errors.array()[0].msg);
    }

    const { email, password } = req.body;

    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { clinic: { select: { id: true, name: true } } },
      });

      // Same error message for missing user and wrong password — prevents user enumeration
      if (!user) return error(res, 401, 'Invalid credentials');

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return error(res, 401, 'Invalid credentials');

      const token = signToken({
        id: user.id,
        role: user.role,
        clinic_id: user.clinic_id, // null for SUPER_ADMIN
      });

      return ok(res, {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          clinic_id: user.clinic_id,
          clinic_name: user.clinic?.name ?? null,
        },
      }, 'Login successful');
    } catch (err) {
      console.error('[AUTH LOGIN]', err);
      return error(res, 500, 'Server error');
    }
  }
);

/**
 * GET /auth/me
 * Returns current user from JWT (no DB call needed)
 */
const { authenticate } = require('../middleware/auth');

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, role: true, clinic_id: true, created_at: true,
        clinic: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!user) return error(res, 404, 'User not found');
    return ok(res, user);
  } catch (err) {
    return error(res, 500, 'Server error');
  }
});

module.exports = router;
