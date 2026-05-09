// ─────────────────────────────────────────────────────────
//  Types matching the backend Prisma schema exactly
// ─────────────────────────────────────────────────────────

export type Role = 'SUPER_ADMIN' | 'CLINIC_USER'

export interface AuthUser {
  id: number
  email: string
  role: Role
  clinic_id: number | null
  clinic_name: string | null
}

export interface Clinic {
  id: number
  name: string
  email: string
  phone: string | null
  whatsapp_instance_name: string | null
  whatsapp_api_key: string | null
  created_at: string
  _count?: {
    patients: number
    appointments: number
    users: number
    messages: number
  }
}

export interface Doctor {
  id: number
  clinic_id: number
  name: string
  specialty: string | null
  schedule: Record<string, string[]> | null
  created_at: string
}

export interface Patient {
  id: number
  clinic_id: number
  name: string
  phone: string
  notes: string | null
  risk_level: 'low' | 'medium' | 'high' | 'emergency' | null
  created_at: string
  appointments?: Appointment[]
  messages?: Message[]
}

export interface Appointment {
  id: number
  clinic_id: number
  patient_id: number | null
  doctor_id: number | null
  appointment_date: string
  appointment_time: string
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  notes: string | null
  source: 'manual' | 'whatsapp' | 'n8n' | null
  created_at: string
  patient?: { id: number; name: string; phone: string; risk_level?: string | null } | null
  doctor?: { id: number; name: string; specialty?: string | null } | null
}

export interface Message {
  id: number
  clinic_id: number
  patient_id: number | null
  phone: string | null
  direction: 'inbound' | 'outbound'
  message: string
  status: string
  timestamp: string
  patient?: { id: number; name: string; phone: string } | null
}

export interface AutomationLog {
  id: number
  clinic_id: number | null
  event_type: string
  phone: string | null
  workflow: string | null
  result: string | null
  error: string | null
  timestamp: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  error?: string
  data: T
}

export interface DashboardStats {
  today_total: number
  today_scheduled: number
  today_completed: number
  total_patients: number
  total_messages: number
  total_doctors: number
  today_appointments: Appointment[]
}

// Keep for backwards compat
export type AppUser = AuthUser
