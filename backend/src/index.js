require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');

const { initSocket } = require('./services/socket');
const { authLimiter, apiLimiter } = require('./middleware/rateLimit');

// Routes
const authRoutes        = require('./routes/auth');
const patientRoutes     = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const messageRoutes     = require('./routes/messages');
const doctorRoutes      = require('./routes/doctors');
const clinicRoutes      = require('./routes/clinics');
const webhookRoutes     = require('./routes/webhook');
const internalRoutes    = require('./routes/internal');

// ─────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ── Socket.io (must be before routes) ─────────────────────
initSocket(server);

// ── Security headers ───────────────────────────────────────
app.use(helmet());

// ── CORS ───────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// ── Body parsing ───────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request logger (dev only) ──────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ─────────────────────────────────────────────────────────
//  API ROUTES
// ─────────────────────────────────────────────────────────

// Public
app.use('/auth',      authLimiter, authRoutes);

// Evolution API webhook — no auth, has its own rate limiter
app.use('/webhook',   webhookRoutes);

// n8n internal callbacks — protected by shared secret, not JWT
app.use('/internal',  internalRoutes);

// Protected API
app.use('/patients',     apiLimiter, patientRoutes);
app.use('/appointments', apiLimiter, appointmentRoutes);
app.use('/messages',     apiLimiter, messageRoutes);
app.use('/doctors',      apiLimiter, doctorRoutes);
app.use('/clinics',      apiLimiter, clinicRoutes);    // SUPER_ADMIN only (enforced inside)

// ── Health check ───────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// ── 404 ────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, error: 'Route not found' }));

// ── Global error handler ───────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Dental SaaS Backend running on port ${PORT}`);
  console.log(`   ENV:      ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Webhook:  POST /webhook/evolution`);
  console.log(`   Internal: POST /internal/n8n/*\n`);
});

module.exports = { app, server };
