-- Migration: dossiers → consultations
-- À exécuter dans le SQL Editor Supabase (isunbvkbhnqpdtdggipa)

-- 1. Créer la table consultations
CREATE TABLE public.consultations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id    uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  patient_id     uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id),
  motif          text NOT NULL DEFAULT 'consultation'
                   CHECK (motif IN ('consultation','urgence','controle','soin','autre')),
  exam_date      date NOT NULL DEFAULT CURRENT_DATE,
  next_exam_date date,
  treated_by     text,
  teeth          text,
  clinical_notes text,
  exams          text,
  exam_files     text[] NOT NULL DEFAULT '{}',
  archived_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES auth.users(id),
  updated_by     uuid REFERENCES auth.users(id)
);

-- 2. RLS
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultations: practice members only"
  ON public.consultations FOR ALL
  USING  (practice_id = current_practice_id())
  WITH CHECK (practice_id = current_practice_id());

CREATE INDEX ON public.consultations (practice_id, patient_id);

-- 3. Migrer les données
INSERT INTO public.consultations (
  id, practice_id, patient_id, user_id,
  motif, exam_date, next_exam_date, treated_by,
  clinical_notes, archived_at, created_at, created_by
)
SELECT
  id, practice_id, patient_id, user_id,
  CASE type
    WHEN 'examen'  THEN 'consultation'
    WHEN 'bilan'   THEN 'controle'
    WHEN 'soin'    THEN 'soin'
    WHEN 'urgence' THEN 'urgence'
    ELSE 'autre'
  END,
  COALESCE(exam_date, CURRENT_DATE),
  next_exam_date, treated_by,
  dental_notes,
  archived_at, created_at, created_by
FROM public.dossiers;

-- 4. Ajouter consultation_id dans factures
ALTER TABLE public.factures ADD COLUMN consultation_id uuid REFERENCES public.consultations(id) ON DELETE SET NULL;

-- 5. Migrer dossier_id → consultation_id
UPDATE public.factures SET consultation_id = dossier_id WHERE dossier_id IS NOT NULL;

-- 6. Supprimer dossier_id de factures
ALTER TABLE public.factures DROP COLUMN dossier_id;

-- 7. Supprimer la table dossiers
DROP TABLE public.dossiers;
