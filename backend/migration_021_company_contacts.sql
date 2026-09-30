-- Migration 021: add company contact fields collected during onboarding
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

NOTIFY pgrst, 'reload schema';
