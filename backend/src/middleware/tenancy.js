/**
 * MULTI-TENANCY ENFORCEMENT
 * ─────────────────────────────────────────────────────────
 * This is the critical isolation layer.
 * MUST be applied after authenticate() on every protected route.
 *
 * It attaches:
 *   req.tenantFilter  → Prisma WHERE clause fragment { clinic_id: X } or {}
 *   req.clinicId      → resolved clinic_id (Int) or null for admin with no filter
 *
 * Rule: CLINIC_USER always gets their JWT clinic_id injected.
 *       SUPER_ADMIN can optionally filter via ?clinic_id= query param.
 */
function enforceTenancy(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  if (req.user.role === 'SUPER_ADMIN') {
    // Admin can optionally scope to one clinic via query param
    const qClinicId = req.query.clinic_id ? parseInt(req.query.clinic_id) : null;
    req.tenantFilter = qClinicId ? { clinic_id: qClinicId } : {};
    req.clinicId = qClinicId;
  } else {
    // CLINIC_USER: ALWAYS enforce their own clinic — never trust frontend
    if (!req.user.clinic_id) {
      return res.status(403).json({ success: false, error: 'No clinic associated with this account' });
    }
    req.tenantFilter = { clinic_id: req.user.clinic_id };
    req.clinicId = req.user.clinic_id;
  }

  next();
}

/**
 * Resolves the clinic_id to use for WRITE operations.
 *
 * CLINIC_USER  → always JWT clinic_id (body.clinic_id is ignored)
 * SUPER_ADMIN  → body.clinic_id required (admin must specify which clinic)
 *
 * Attaches req.resolvedClinicId (Int)
 * Must be used AFTER enforceTenancy.
 */
function resolveWriteClinic(req, res, next) {
  if (req.user.role === 'SUPER_ADMIN') {
    const clinicId = req.body.clinic_id ?? req.clinicId;
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        error: 'clinic_id is required in request body for admin write operations',
      });
    }
    req.resolvedClinicId = parseInt(clinicId);
  } else {
    // Never trust the frontend — always use JWT value
    req.resolvedClinicId = req.user.clinic_id;
  }
  next();
}

module.exports = { enforceTenancy, resolveWriteClinic };
