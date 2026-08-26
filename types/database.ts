export type TreatmentCategory =
  | 'nettoyage'
  | 'obturation'
  | 'extraction'
  | 'couronne'
  | 'implant'
  | 'orthodontie'
  | 'blanchiment'
  | 'prothese'
  | 'autre'

export type FactureStatus = 'en_attente' | 'en_cours' | 'payee' | 'annulee'
export type AppointmentType = 'consultation' | 'nettoyage' | 'soin' | 'chirurgie' | 'controle' | 'orthodontie' | 'autre'
export type AppointmentStatus = 'planifie' | 'termine' | 'annule' | 'absent'
export type DossierType = 'examen' | 'soin' | 'bilan' | 'urgence' | 'autre'

export interface Patient {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface Dossier {
  id: string
  user_id: string
  patient_id: string
  type: DossierType
  exam_date: string
  next_exam_date: string | null
  treated_by: string | null
  dental_notes: string | null
  document_path: string | null
  created_at: string
  archived_at: string | null
}

export interface Traitement {
  id: string
  user_id: string
  name: string
  category: TreatmentCategory
  price: number
  duration_minutes: number
  description: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Facture {
  id: string
  user_id: string
  patient_id: string
  dossier_id: string | null
  appointment_id: string | null
  status: FactureStatus
  total_price: number
  deposit_paid: number
  notes: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface FactureItem {
  id: string
  facture_id: string
  traitement_id: string | null
  description: string
  quantity: number
  unit_price: number
}

export interface Appointment {
  id: string
  user_id: string
  patient_id: string | null
  title: string
  scheduled_at: string
  duration_minutes: number
  type: AppointmentType
  status: AppointmentStatus
  notes: string | null
  created_at: string
  archived_at: string | null
}

export interface FactureWithPatient extends Facture {
  patients: Pick<Patient, 'first_name' | 'last_name' | 'phone'>
}

export interface AppointmentWithPatient extends Appointment {
  patients: Pick<Patient, 'first_name' | 'last_name'> | null
}

export interface DossierWithPatient extends Dossier {
  patients: Pick<Patient, 'first_name' | 'last_name'>
}

export interface TreatmentAttribute {
  id: string
  user_id: string
  attr_type: 'category' | 'option'
  name: string
  sort_order: number
  created_at: string
}
