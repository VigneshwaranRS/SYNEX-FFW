# SYNEX — AI Club Event Website

A production-grade event registration website for SYNEX, the AI Club's flagship technology event.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript, Vite |
| Styling | Plain CSS with custom design system |
| Database + Auth | Supabase (PostgreSQL + RLS + Auth) |
| Server logic | Supabase Edge Functions (Deno) |
| Validation | Zod v4 |
| Routing | React Router v7 |
| Hosting (recommended) | Vercel |

---

## Quick start (local development)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd Synex
npm install
```

### 2. Create your environment file

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your real values:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> **Never** put the `service_role` key in a `VITE_` variable or any frontend file. It lives exclusively in Edge Function secrets.

### 3. Set up the database

1. Open your [Supabase Dashboard](https://app.supabase.com) → **SQL Editor**.
2. Run the contents of `supabase/migrations/001_schema.sql`.
3. Create the storage bucket manually:
   - Go to **Storage** → **New bucket**
   - Name: `payment-qr`, Public: **Yes** (the QR image is a public payment display asset only — contains no secrets)
   - Set upload policy: only authenticated users with the `admin` role

### 4. Deploy Edge Functions

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the registration function
supabase functions deploy register

# Set the service_role secret (server-side only, NEVER in frontend)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 5. Provision organizer accounts

There is **no self-registration** for organizer accounts. An admin must provision accounts manually:

```sql
-- Step 1: Create the user via Supabase Auth (Dashboard → Authentication → Users → Add user)
-- Step 2: Note the UID, then run:
INSERT INTO organizer_profiles (id, role, display_name)
VALUES (
  'auth-uid-here',     -- from step 1
  'admin',             -- or 'checkin_staff'
  'Organizer Name'
);
```

### 6. Run locally

```bash
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) (public site) and [http://localhost:5173/admin](http://localhost:5173/admin) (organizer dashboard).

---

## Project structure

```
src/
  config/
    event.ts              # Typed defaults (not the live source of truth)
  lib/
    supabase.ts           # Typed public client (anon key only)
    supabaseAdmin.ts      # Untyped client for admin page writes
    database.types.ts     # Manually-typed DB schema
    validation.ts         # Zod schemas for all forms
  contexts/
    AuthContext.tsx        # Auth state + organizer role
    EventSettingsContext.tsx  # Live event config from DB
  components/
    Nav.tsx / Nav.css     # Top navigation
    Hero.tsx / Hero.css   # Landing hero section
    SignalMotif.tsx        # Pure SVG circuit/signal illustration
    EventDetails.tsx       # Date, venue, eligibility, sessions
    RegistrationForm.tsx   # Public registration form
    FAQ.tsx                # FAQ accordion
    Footer.tsx             # Footer
  pages/
    PublicPage.tsx         # Public landing page
    admin/
      AdminPage.tsx        # Auth guard
      AdminLogin.tsx       # Login screen
      AdminDashboard.tsx   # Dashboard shell + tabs
      AdminRegistrations.tsx  # Registration management
      AdminEventSettings.tsx  # Event CMS
      AdminPaymentSettings.tsx  # Payment & QR management

supabase/
  migrations/
    001_schema.sql         # Full schema + RLS policies
  functions/
    register/index.ts      # Server-side registration Edge Function
    _shared/cors.ts        # Shared CORS headers
```

---

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` + Vercel | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` + Vercel | Public anon key (safe for frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function secrets only | **Server-side only. Never in frontend.** |

---

## Deployment (Vercel)

1. Push the repo to GitHub.
2. Import the repository in [Vercel](https://vercel.com).
3. Add the environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in Vercel's settings.
4. Deploy. Vercel auto-detects Vite.

---

## Admin dashboard

Navigate to `/admin`. Only pre-provisioned organizer accounts can sign in.

### Roles

| Role | Capabilities |
|---|---|
| `admin` | All: registrations, check-in, event settings, payment settings, CSV export |
| `checkin_staff` | Registrations view and check-in only |

### Event settings (admin only)

- Edit event title, description, date, venue, eligibility, fees, registration open/closed state, FAQ, contact details, privacy notice.
- **Save draft** → saves without affecting public site.
- **Publish** → makes changes live immediately. Shows a warning for sensitive changes (fees, eligibility, open/close).
- **Unpublish** → removes public settings; site falls back to safe defaults.
- Full audit log of every change with actor identity and timestamp.

### Payment settings (admin only)

- Upload the official QR image (PNG/JPEG/GIF/WebP, max 2 MB).
- Set payee name, payment instructions, and which participant categories payment applies to.
- Toggle QR visibility per category.
- **Never generates or fabricates a QR code.** Organizer supplies the official image.

---

## Registration flow

1. Public visitor fills the form at `/#register`.
2. Client-side validation runs (Zod).
3. On submit, the `register` Supabase Edge Function is called — it:
   - Validates all fields server-side
   - Checks registration is open (authoritative)
   - Checks capacity (if configured)
   - Enforces email uniqueness via database constraint
   - Generates a non-sequential reference (`SYN-XXXX-XXXX`)
   - Creates a payment record if payment is enabled
   - Returns only the public reference — no internal IDs
4. Participant sees their reference in the confirmation screen.

---

## Security notes

- RLS enabled on all tables. Anonymous users cannot read registrations, payments, or attendance.
- The `service_role` key lives only in Edge Function secrets. It is never placed in frontend code or `VITE_` variables.
- Payment verification requires an admin action on the server — client-submitted payment status is never trusted.
- Check-in is protected by a database unique constraint preventing duplicate check-ins.
- No organizer self-registration. Accounts must be provisioned by an existing admin.
- No verbose error messages expose SQL, database structure, or credentials.

---

## Launch checklist

Before opening public registration, confirm each item with the organizers:

- [ ] Official event date and time
- [ ] Venue name and address
- [ ] Official event description, tracks, and schedule
- [ ] Eligibility rules — exact wording for internal vs external
- [ ] How SIMATS affiliation will be verified
- [ ] Whether internal registration is free (fee = 0)
- [ ] Exact external-college fee and currency
- [ ] Approved payment method and payee details
- [ ] Official payment QR image (supplied by organizers, not generated)
- [ ] Who is authorized to verify payments
- [ ] Registration opening and closing times
- [ ] Capacity and waitlist policy
- [ ] Required registration fields (phone, year, department)
- [ ] Official contact email
- [ ] Privacy notice text (organizer-approved)
- [ ] Authorized organizer accounts and roles provisioned in DB
- [ ] Whether QR check-in is needed or manual search is sufficient
- [ ] Whether confirmation emails are needed (not currently configured)
- [ ] Data-retention and deletion policy approved
- [ ] All environment variables set in production
- [ ] Database migrations run on production Supabase instance
- [ ] Edge Function deployed with service_role secret
- [ ] Storage bucket `payment-qr` created with correct policies
- [ ] Production URL tested end-to-end

---

## Known limitations and next steps

| Item | Status |
|---|---|
| Email confirmations | **Not configured.** Wire up Resend or another provider via a send-confirmation Edge Function. |
| QR code check-in scanning | **Not implemented.** Manual search check-in works. QR scan can be added as an enhancement. |
| Payment gateway | **Not configured.** Payment is manually verified by admins. Integrate Razorpay or a gateway by adding a server-side session creation Edge Function and a webhook handler. |
| Session/FAQ admin UI | Schema and API exist; admin UI to add/edit sessions and FAQs not yet built. Use Supabase Table Editor as interim. |
| Supabase CLI types | Run `supabase gen types typescript > src/lib/database.types.ts` after connecting your project for full type safety instead of manually-written types. |
| Offline check-in | Export the registration CSV before the event. Reconcile offline check-ins manually after connectivity returns. |
