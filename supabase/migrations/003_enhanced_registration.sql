-- ═══════════════════════════════════════════════════════════════
-- SYNEX Schema Migration 003 — Enhanced Registration Fields
-- Adds: transaction_id, payment_screenshot_url, project_pdf_url
-- Expands team_members JSONB to support {name, email, phone}
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- Add new columns to registrations for file uploads & payment info
-- ─────────────────────────────────────────────────────────────
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS project_pdf_url TEXT;

-- ─────────────────────────────────────────────────────────────
-- Create storage bucket for registration uploads (screenshots + PDFs)
-- This needs to be run once. If it fails due to existing bucket, that's OK.
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('registration-uploads', 'registration-uploads', TRUE)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Storage policies for registration-uploads bucket
-- Anyone can upload (via edge function using service_role)
-- Public read (so admins can view screenshots/PDFs)
-- ─────────────────────────────────────────────────────────────

-- Allow public read access to uploaded files
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'public_read_registration_uploads'
  ) THEN
    CREATE POLICY "public_read_registration_uploads"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'registration-uploads');
  END IF;
END $$;

-- Allow anyone to upload files to the registration-uploads bucket
-- (the registration form uploads directly from the browser using the anon key)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'allow_upload_registration_uploads'
  ) THEN
    CREATE POLICY "allow_upload_registration_uploads"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'registration-uploads');
  END IF;
END $$;

-- Allow authenticated users (admins) to upload/update QR images in payment-qr bucket
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'allow_upload_payment_qr'
  ) THEN
    CREATE POLICY "allow_upload_payment_qr"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'payment-qr');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'allow_update_payment_qr'
  ) THEN
    CREATE POLICY "allow_update_payment_qr"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'payment-qr');
  END IF;
END $$;
