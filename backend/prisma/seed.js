require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('\n🌱 Seeding dental SaaS database...\n');

  // ── Clinics ──────────────────────────────────────────────
  const clinicA = await prisma.clinic.upsert({
    where: { email: 'clinica@dentaflow.com' },
    update: {},
    create: {
      name: 'Dr Smile Dental — Clinic A',
      email: 'clinica@dentaflow.com',
      phone: '+201001234567',
      whatsapp_instance_name: 'Ali Sakr',
      whatsapp_api_key: 'evo_key_x9f3m7k2',
    },
  });
  console.log(`✅ Clinic A created (id: ${clinicA.id})`);

  const clinicB = await prisma.clinic.upsert({
    where: { email: 'clinicb@dentaflow.com' },
    update: {},
    create: {
      name: 'Bright Smiles — Clinic B',
      email: 'clinicb@dentaflow.com',
      phone: '+201009876543',
      whatsapp_instance_name: 'whatsapp-bot-b',
      whatsapp_api_key: 'evo_key_clinicb_placeholder',
    },
  });
  console.log(`✅ Clinic B created (id: ${clinicB.id})`);

  // ── Users ────────────────────────────────────────────────
  const userDefs = [
    { email: 'admin@dentaflow.com',   password: 'Admin123!',  role: 'SUPER_ADMIN', clinic_id: null },
    { email: 'clinica@dentaflow.com', password: 'Clinic123!', role: 'CLINIC_USER', clinic_id: clinicA.id },
    { email: 'clinicb@dentaflow.com', password: 'Clinic123!', role: 'CLINIC_USER', clinic_id: clinicB.id },
  ];

  for (const u of userDefs) {
    const hash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { password_hash: hash },
      create: { email: u.email, password_hash: hash, role: u.role, clinic_id: u.clinic_id },
    });
    console.log(`✅ User: ${u.email}  /  ${u.password}  (${u.role})`);
  }

  // ── Doctors ──────────────────────────────────────────────
  const drAhmed = await prisma.doctor.create({
    data: { clinic_id: clinicA.id, name: 'Dr. Ahmed Hassan', specialty: 'General Dentistry',
      schedule: { sun: ['09:00','17:00'], mon: ['09:00','17:00'], wed: ['09:00','13:00'] } },
  }).catch(() => prisma.doctor.findFirst({ where: { clinic_id: clinicA.id, name: 'Dr. Ahmed Hassan' } }));

  await prisma.doctor.create({
    data: { clinic_id: clinicA.id, name: 'Dr. Mona Fathy', specialty: 'Orthodontics',
      schedule: { tue: ['10:00','18:00'], thu: ['10:00','18:00'] } },
  }).catch(() => null);

  await prisma.doctor.create({
    data: { clinic_id: clinicB.id, name: 'Dr. Sara Khalil', specialty: 'Orthodontics' },
  }).catch(() => null);

  console.log('✅ Doctors seeded');

  // ── Patients (Clinic A) ──────────────────────────────────
  const marwan = await prisma.patient.upsert({
    where: { clinic_id_phone: { clinic_id: clinicA.id, phone: '201099937072' } },
    update: {},
    create: {
      clinic_id: clinicA.id,
      name: 'Marwan Abdallah',
      phone: '201099937072',
      notes: 'Test patient — linked to Evolution API WhatsApp number',
      risk_level: 'low',
    },
  });

  const patient2 = await prisma.patient.upsert({
    where: { clinic_id_phone: { clinic_id: clinicA.id, phone: '201011223344' } },
    update: {},
    create: { clinic_id: clinicA.id, name: 'Ahmed Samy', phone: '201011223344', risk_level: 'medium' },
  });

  // ── Patients (Clinic B — isolated) ──────────────────────
  await prisma.patient.upsert({
    where: { clinic_id_phone: { clinic_id: clinicB.id, phone: '201099887766' } },
    update: {},
    create: { clinic_id: clinicB.id, name: 'Noha Clinic B Patient', phone: '201099887766', risk_level: 'low' },
  });

  console.log('✅ Patients seeded');

  // ── Appointments ─────────────────────────────────────────
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  await prisma.appointment.create({
    data: {
      clinic_id: clinicA.id,
      patient_id: marwan.id,
      doctor_id: drAhmed?.id ?? null,
      appointment_date: tomorrow,
      appointment_time: '10:00',
      status: 'scheduled',
      source: 'manual',
      notes: 'Routine checkup',
    },
  }).catch(() => null);

  await prisma.appointment.create({
    data: {
      clinic_id: clinicA.id,
      patient_id: patient2.id,
      doctor_id: drAhmed?.id ?? null,
      appointment_date: tomorrow,
      appointment_time: '11:30',
      status: 'scheduled',
      source: 'whatsapp',
      notes: 'Booked via WhatsApp',
    },
  }).catch(() => null);

  console.log('✅ Appointments seeded');

  // ── Sample messages ──────────────────────────────────────
  await prisma.message.create({
    data: {
      clinic_id: clinicA.id,
      patient_id: marwan.id,
      phone: '201099937072',
      direction: 'inbound',
      message: 'أهلاً، عايز أحجز موعد بكرة',
      status: 'received',
    },
  }).catch(() => null);

  await prisma.message.create({
    data: {
      clinic_id: clinicA.id,
      patient_id: marwan.id,
      phone: '201099937072',
      direction: 'outbound',
      message: 'أهلاً مرحباً! تم تأكيد موعدك غداً الساعة 10 صباحاً ✅',
      status: 'sent',
    },
  }).catch(() => null);

  console.log('✅ Messages seeded');

  console.log('\n' + '─'.repeat(50));
  console.log('📋 LOGIN CREDENTIALS');
  console.log('─'.repeat(50));
  console.log('  SUPER ADMIN:');
  console.log('    Email:    admin@dentaflow.com');
  console.log('    Password: Admin123!');
  console.log('');
  console.log('  CLINIC A:');
  console.log('    Email:    clinica@dentaflow.com');
  console.log('    Password: Clinic123!');
  console.log(`    ID:       ${clinicA.id}`);
  console.log('');
  console.log('  CLINIC B:');
  console.log('    Email:    clinicb@dentaflow.com');
  console.log('    Password: Clinic123!');
  console.log(`    ID:       ${clinicB.id}`);
  console.log('─'.repeat(50));
  console.log('\n✅ Seed complete!\n');
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
