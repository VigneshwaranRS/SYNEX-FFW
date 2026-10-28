-- ═══════════════════════════════════════════════════════════════
-- SYNEX Schema Migration 002 — Team-based Registration
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- Add team columns to registrations
-- ─────────────────────────────────────────────────────────────
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS team_name TEXT,
  ADD COLUMN IF NOT EXISTS team_members JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ─────────────────────────────────────────────────────────────
-- Allow admins to DELETE registrations (for event cleanup)
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  -- Check if policy already exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'registrations' AND policyname = 'admins_delete_registrations'
  ) THEN
    CREATE POLICY "admins_delete_registrations"
      ON registrations FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM organizer_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Allow admins to DELETE attendance records (for event cleanup)
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'attendance' AND policyname = 'admins_delete_attendance'
  ) THEN
    CREATE POLICY "admins_delete_attendance"
      ON attendance FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM organizer_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Allow admins to DELETE payments (for event cleanup)
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payments' AND policyname = 'admins_delete_payments'
  ) THEN
    CREATE POLICY "admins_delete_payments"
      ON payments FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM organizer_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Allow admins to DELETE event_settings_audit (for event cleanup)
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'event_settings_audit' AND policyname = 'admins_delete_audit'
  ) THEN
    CREATE POLICY "admins_delete_audit"
      ON event_settings_audit FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM organizer_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;
