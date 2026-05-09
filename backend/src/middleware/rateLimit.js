const rateLimit = require('express-rate-limit');

// Strict limiter for login — prevents brute force
// In development, use higher limits to avoid blocking during testing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,         // 1 minute
  max: 120,
  message: { success: false, error: 'Rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// High-throughput webhook limiter (Evolution API sends many events)
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  message: { success: false, error: 'Webhook rate limit exceeded.' },
});

module.exports = { authLimiter, apiLimiter, webhookLimiter };
