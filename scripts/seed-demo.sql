-- =============================================================
--  DentaFlow Demo Data — PostgreSQL
--  Run against your dental_saas database:
--    psql -U postgres -d dental_saas -f scripts/seed-demo.sql
--
--  This SQL mirrors the Node.js seeder in backend/prisma/seed.js
--  Use whichever is more convenient.
-- =============================================================

-- Clinics
INSERT INTO clinics (id, clinic_name, email, phone, address, status, whatsapp_instance_name)
VALUES
  (1, 'Dr Smile Dental', 'contact@drsmile.com', '01234567890', '15 Nile St, Cairo', 'active', 'ali sakr'),
  (2, 'Bright Smiles', 'info@brightsmiles.com', '01098765432', '22 Pyramids Rd, Giza', 'active', NULL)
ON CONFLICT (id) DO NOTHING;

-- Doctors
INSERT INTO doctors (id, clinic_id, name, specialty)
VALUES
  (1, 1, 'Dr. Ahmed Hassan', 'General Dentistry'),
  (2, 1, 'Dr. Mona Fathy', 'Orthodontics'),
  (3, 2, 'Dr. Karim Nasser', 'General Dentistry')
ON CONFLICT (id) DO NOTHING;

-- Users
-- Passwords are bcrypt hashes of: Admin123! and Clinic123!
INSERT INTO users (id, clinic_id, name, email, password_hash, role)
VALUES
  (1, NULL,  'Super Admin',  'admin@dentaflow.com',   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'SUPER_ADMIN'),
  (2, 1,     'Clinic A Admin', 'clinica@dentaflow.com', '$2a$10$hHNMFoF7rjOhWkR.iDT7QuNWtMF.H4BjAHQaQ9u2LrfSRiMzLfFsq', 'CLINIC_USER'),
  (3, 2,     'Clinic B Admin', 'clinicb@dentaflow.com', '$2a$10$hHNMFoF7rjOhWkR.iDT7QuNWtMF.H4BjAHQaQ9u2LrfSRiMzLfFsq', 'CLINIC_USER')
ON CONFLICT (id) DO NOTHING;

-- Sample patients
INSERT INTO patients (id, clinic_id, name, phone)
VALUES
  (1, 1, 'Marwan Abdallah', '201099937072'),
  (2, 1, 'Ahmed Samy',      '201011223344'),
  (3, 2, 'Sara Mohamed',    '201055667788')
ON CONFLICT (clinic_id, phone) DO NOTHING;

-- Sample appointments
INSERT INTO appointments (clinic_id, patient_id, doctor_id, appointment_date, appointment_time, status, source, notes)
VALUES
  (1, 1, 1, CURRENT_DATE + 1, '10:00', 'scheduled', 'manual', 'Regular checkup'),
  (1, 2, 2, CURRENT_DATE + 2, '11:30', 'scheduled', 'whatsapp', 'Orthodontic consultation'),
  (1, 1, 1, CURRENT_DATE + 7, '09:00', 'scheduled', 'whatsapp', 'Follow-up');
