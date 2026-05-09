const axios = require('axios');
const prisma = require('../config/prisma');

const EVO_BASE = process.env.EVOLUTION_API_BASE_URL;
const EVO_GLOBAL_KEY = process.env.EVOLUTION_API_KEY;
const DEFAULT_INSTANCE = process.env.DEFAULT_WA_INSTANCE || 'default-instance';

/**
 * Get Evolution API credentials for a specific clinic.
 * Falls back to global env credentials if the clinic hasn't set its own.
 */
async function getClinicCreds(clinic_id) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinic_id },
    select: { whatsapp_instance_name: true, whatsapp_api_key: true },
  });
  return {
    instance: clinic?.whatsapp_instance_name || DEFAULT_INSTANCE,
    apiKey: clinic?.whatsapp_api_key || EVO_GLOBAL_KEY,
  };
}

/**
 * Resolve which clinic owns an Evolution API instance.
 * Used when an inbound webhook arrives to map instance → clinic_id.
 *
 * @param {string} instanceName
 * @returns {number|null} clinic_id or null if not found
 */
async function resolveClinicFromInstance(instanceName) {
  if (!instanceName) return null;
  const clinic = await prisma.clinic.findFirst({
    where: { whatsapp_instance_name: { equals: instanceName, mode: 'insensitive' } },
    select: { id: true },
  });
  return clinic?.id ?? null;
}

/**
 * Send a WhatsApp text message.
 *
 * @param {number} clinic_id
 * @param {string} to   — phone number (digits only, e.g. "201234567890")
 * @param {string} text
 */
async function sendText(clinic_id, to, text) {
  const { instance, apiKey } = await getClinicCreds(clinic_id);
  // Normalise: strip non-digits, ensure starts with country code
  const number = to.replace(/\D/g, '').replace(/^0/, '20');

  const { data } = await axios.post(
    `${EVO_BASE}/message/sendText/${instance}`,
    { number, text, delay: 1000 },
    { headers: { apikey: apiKey, 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  return data;
}

module.exports = { sendText, resolveClinicFromInstance, getClinicCreds };
