-- ═══════════════════════════════════════════════════════════════
-- SYNEX Database Schema & RLS Policies
-- Run in: Supabase Dashboard → SQL Editor
-- Or: supabase db push (with Supabase CLI)
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- Organizer profiles
-- Only pre-authorized staff exist in this table.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizer_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'checkin_staff')),
  display_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE organizer_profiles ENABLE ROW LEVEL SECURITY;

-- Organizers can read their own profile
CREATE POLICY "organizers_read_own"
  ON organizer_profiles FOR SELECT
  USING (auth.uid() = id);

-- Only the Supabase service role (Edge Functions / backend) can insert
-- organizer profiles. Never allow public self-registration.
CREATE POLICY "service_only_insert"
  ON organizer_profiles FOR INSERT
  WITH CHECK (FALSE); -- blocked for anon/authenticated; service role bypasses RLS

-- ─────────────────────────────────────────────────────────────
-- Event settings (mini CMS)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date            DATE,
  event_start_time      TIME,
  event_end_time        TIME,
  timezone              TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  venue_name            TEXT,
  venue_address         TEXT,
  venue_map_url         TEXT,
  tagline               TEXT NOT NULL DEFAULT 'The AI Club''s flagship technology event.',
  short_description     TEXT NOT NULL DEFAULT '',
  registration_open     BOOLEAN NOT NULL DEFAULT FALSE,
  registration_deadline TIMESTAMPTZ,
  capacity              INTEGER CHECK (capacity > 0),
  waitlist_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  eligibility_rules     TEXT,
  internal_student_fee  NUMERIC(10, 2) CHECK (internal_student_fee >= 0),
  external_student_fee  NUMERIC(10, 2) CHECK (external_student_fee >= 0),
  fee_currency          CHAR(3) NOT NULL DEFAULT 'INR',
  payment_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  payment_instructions  TEXT,
  contact_email         TEXT,
  privacy_notice        TEXT,
  published             BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by            UUID REFERENCES auth.users(id),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;

-- Public can read ONLY published rows
CREATE POLICY "public_read_published_settings"
  ON event_settings FOR SELECT
  USING (published = TRUE);

-- Admins can read all rows (draft + published)
CREATE POLICY "admins_read_all_settings"
  ON event_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organizer_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can write
CREATE POLICY "admins_write_settings"
  ON event_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organizer_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizer_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Event sessions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  start_time    TIMESTAMPTZ,
  end_time      TIMESTAMPTZ,
  track         TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_sessions"
  ON event_sessions FOR SELECT USING (TRUE);

CREATE POLICY "admins_write_sessions"
  ON event_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM organizer_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM organizer_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────────────────────
-- Event FAQs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_faqs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_faqs"
  ON event_faqs FOR SELECT USING (TRUE);

CREATE POLICY "admins_write_faqs"
  ON event_faqs FOR ALL
  USING (EXISTS (SELECT 1 FROM organizer_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM organizer_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────────────────────
-- Registrations
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registrations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        TEXT NOT NULL UNIQUE,  -- non-sequential public reference
  full_name        TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
  email            TEXT NOT NULL,         -- normalized lowercase by Edge Function
  phone            TEXT,
  institution      TEXT NOT NULL CHECK (char_length(institution) BETWEEN 2 AND 150),
  affiliation      TEXT NOT NULL CHECK (affiliation IN ('internal', 'external')),
  department       TEXT,
  year_of_study    TEXT,
  consent_given    BOOLEAN NOT NULL DEFAULT FALSE,
  consent_timestamp TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'waitlisted', 'cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique email per event (change to (email, event_id) if multi-event later)
CREATE UNIQUE INDEX IF NOT EXISTS registrations_email_unique
  ON registrations (LOWER(email));

ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Anonymous users cannot read the registration list
CREATE POLICY "anon_no_read_registrations"
  ON registrations FOR SELECT
  USING (FALSE);

-- Organizers (any role) can read
CREATE POLICY "organizers_read_registrations"
  ON registrations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM organizer_profiles WHERE id = auth.uid())
  );

-- Public INSERT is handled ONLY via the 'register' Edge Function
-- which uses the service_role. Direct anonymous insert is blocked.
CREATE POLICY "no_direct_anon_insert"
  ON registrations FOR INSERT
  WITH CHECK (FALSE);

-- Only admins can update/delete (e.g. cancel)
CREATE POLICY "admins_update_registrations"
  ON registrations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM organizer_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────────────────────
-- Payments
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE payment_status_enum AS ENUM (
    'not_required', 'pending', 'submitted_for_review', 'verified', 'failed', 'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id      UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  amount               NUMERIC(10, 2) CHECK (amount >= 0),
  currency             CHAR(3) NOT NULL DEFAULT 'INR',
  status               payment_status_enum NOT NULL DEFAULT 'pending',
  provider_reference   TEXT,
  verified_by          UUID REFERENCES auth.users(id),
  verified_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Participants cannot read payments (privacy)
CREATE POLICY "anon_no_read_payments"
  ON payments FOR SELECT USING (FALSE);

-- Organizers can read
CREATE POLICY "organizers_read_payments"
  ON payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM organizer_profiles WHERE id = auth.uid()));

-- Only admins can verify payments
CREATE POLICY "admins_update_payments"
  ON payments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM organizer_profiles WHERE id = auth.uid() AND role = 'admin'));

-- Inserts via Edge Function (service_role)
CREATE POLICY "no_direct_anon_payment_insert"
  ON payments FOR INSERT WITH CHECK (FALSE);

-- ─────────────────────────────────────────────────────────────
-- Attendance
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id   UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  checked_in_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_in_by     UUID NOT NULL REFERENCES auth.users(id),
  CONSTRAINT attendance_one_checkin_per_reg UNIQUE (registration_id)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_no_read_attendance"
  ON attendance FOR SELECT USING (FALSE);

CREATE POLICY "organizers_read_attendance"
  ON attendance FOR SELECT
  USING (EXISTS (SELECT 1 FROM organizer_profiles WHERE id = auth.uid()));

-- Any organizer role can check in
CREATE POLICY "organizers_insert_attendance"
  ON attendance FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM organizer_profiles WHERE id = auth.uid())
    AND auth.uid() = checked_in_by
  );

-- ─────────────────────────────────────────────────────────────
-- Payment settings
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payee_label               TEXT,
  payment_instructions      TEXT,
  qr_image_path             TEXT,
  qr_enabled                BOOLEAN NOT NULL DEFAULT FALSE,
  applicable_categories     TEXT[] NOT NULL DEFAULT '{}',
  amount_rules              TEXT,
  payment_reference_format  TEXT,
  enabled                   BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by                UUID REFERENCES auth.users(id),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

-- Public can read (for payment instructions display) ONLY if enabled
CREATE POLICY "public_read_enabled_payment_settings"
  ON payment_settings FOR SELECT
  USING (enabled = TRUE);

-- Admins can read all
CREATE POLICY "admins_read_payment_settings"
  ON payment_settings FOR SELECT
  USING (EXISTS (SELECT 1 FROM organizer_profiles WHERE id = auth.uid() AND role = 'admin'));

-- Only admins can write
CREATE POLICY "admins_write_payment_settings"
  ON payment_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM organizer_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM organizer_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────────────────────
-- Audit log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_settings_audit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES auth.users(id),
  actor_email TEXT,
  action      TEXT NOT NULL,
  summary     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_settings_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY "admins_read_audit"
  ON event_settings_audit FOR SELECT
  USING (EXISTS (SELECT 1 FROM organizer_profiles WHERE id = auth.uid() AND role = 'admin'));

-- Organizers (any role) can insert audit entries
CREATE POLICY "organizers_insert_audit"
  ON event_settings_audit FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM organizer_profiles WHERE id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- Storage bucket setup (run via Supabase dashboard or CLI)
-- ─────────────────────────────────────────────────────────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('payment-qr', 'payment-qr', TRUE)
-- ON CONFLICT DO NOTHING;
--
-- Storage policy: Only admins can upload; bucket is public read (for payment display)
-- Set up via Dashboard → Storage → payment-qr → Policies
