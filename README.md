# OLFU CCS Competition Tabulation System

A comprehensive web-based competition tabulation system built for the **Our Lady of Fatima University (OLFU) College of Computer Studies (CCS)**. The platform administers university competitions, individual and team events, judge scoring, automated ranking calculation, result finalization, and public verdict publishing.

Official scores, percentage weights, rankings, and placement verdicts are calculated within PostgreSQL and protected by Supabase Row Level Security (RLS) rather than being trusted to browser-side code.

---

## Stack

- **Frontend**: React 19, TypeScript 5.7, Vite 8
- **Styling**: Tailwind CSS v4 (with `@tailwindcss/vite` plugin and custom typography)
- **Typography**: Literata (Display), Instrument Sans (Body), Azeret Mono (Data/Code)
- **Routing**: React Router v8
- **Backend & Database**: Supabase Auth, PostgreSQL 15+, Row Level Security (RLS)
- **PostgreSQL Logic**: Stored functions, scoring triggers, dynamic ranking views, audit logging
- **Package Manager**: pnpm (`10.34.3` via `.mise.toml`)

---

## Requirements

- **Node.js**: 22+ (tested on Node 22 and Node 24)
- **pnpm**: 10+
- **Git**: Installed and initialized
- **Supabase Account / Project**: An existing Supabase project (e.g. `dlgglkozevuzdvilushe`)
- **Supabase CLI**: Optional for hosted deployment; required for local PostgreSQL testing

---

## 1. Clone / Open Project

Open the project directory in your terminal or IDE:

```bash
cd "c:\Users\ASUS\Desktop\Tabulation System"
```

---

## 2. Install Dependencies

Install all required packages using `pnpm`:

```bash
pnpm install
```

> **Windows Note**: If running PowerShell with script execution disabled, run `pnpm` through `npx.cmd pnpm@10.34.3 install` or use the command prompt.

---

## 3. Environment Variables

Create your local environment file by copying the template:

```bash
cp .env.example .env.local
```

Inside `.env.local`, specify your public browser-safe Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> [!CAUTION]
> **CRITICAL SECURITY RULE**: Never put a Supabase `service_role` key inside `.env.local`, React code, TypeScript code, or anywhere accessible to the browser. Only the public `anon` / publishable key is safe for frontend client initialization. Git will ignore `.env.local` automatically.

---

## 4. Connect to Hosted Supabase (Mode A — Recommended)

In this mode, your frontend runs locally while connected to your existing hosted Supabase project.

1. Authenticate with Supabase CLI:
   ```bash
   supabase login
   ```
2. Link to your existing Supabase project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   *(Replace `YOUR_PROJECT_REF` with your actual project reference ID).*

---

## 5. Apply Database Migrations

Deploy version-controlled database migrations to your linked Supabase project:

```bash
supabase db push
```

This applies the numbered migration files in `supabase/migrations/`:
1. `202609030001_initial_schema.sql` — Base tables, enums, triggers, RLS, and functions.
2. `202609030002_harden_rls_and_scoring.sql` — RLS hardening, scoring engine validation triggers, delete policies, public result access, and admin finalization procedures.

---

## 6. Local Supabase (Mode B — Optional)

If you prefer to run a completely local PostgreSQL database with Docker:

1. Start the local Supabase container stack:
   ```bash
   supabase start
   ```
2. Reset and migrate the local database:
   ```bash
   supabase db reset
   ```
3. Update `.env.local` with the local API URL (`http://127.0.0.1:54321`) and the local `anon` key output by the CLI.
4. Stop the local stack when finished:
   ```bash
   supabase stop
   ```

---

## 7. Run Frontend

Start the Vite development server:

```bash
pnpm dev
```

Open the displayed URL in your browser (default: `http://localhost:8443` or `http://localhost:5173`).

---

## 8. Build and Typecheck

Validate TypeScript types and build the production bundle:

```bash
pnpm typecheck
pnpm build
```

Preview the production build locally:

```bash
pnpm preview
```

---

## 9. Future Database Changes & Development Workflow

All database modifications must follow the migration workflow to prevent discrepancies between environments:

```text
Modify application
       ↓
Create new migration:
supabase migration new <descriptive_change_name>
       ↓
Edit SQL in supabase/migrations/<timestamp>_<descriptive_name>.sql
       ↓
Test migration on clean local database:
supabase db reset
       ↓
Run frontend and verify:
pnpm dev
       ↓
Validate types and production build:
pnpm typecheck && pnpm build
       ↓
Review migration diff
       ↓
Push migration to hosted project:
supabase db push
       ↓
Hosted Supabase updated
```

---

## 10. Seed Data: The Six Official Events

The system supports the department's six official competition events:
1. **Quiz Bee** (Knowledge / Individual)
2. **Programming Competition** (Technical / Team)
3. **Linux Competition** (Technical / Team)
4. **PC Assembly and Disassembly** (Technical / Team)
5. **Dance Competition** (Performance / Team)
6. **Pageant** (Performance / Individual)

### Seeding Options:
- **In the UI**: Under **Events**, select an active competition and click the **"Seed Official 6 Events"** button.
- **In the SQL Editor**: Execute the function provided in `supabase/seed.sql`:
  ```sql
  select public.seed_initial_events('YOUR_COMPETITION_UUID'::uuid, public.current_profile_id());
  ```

---

## 11. Authentication & Roles

The system recognizes three roles:
- `admin`: Full control over competitions, events, contestant registrations, judge assignments, criteria unlocking, score sheets, finalization, publishing, and audit logs.
- `judge`: Can access assigned events, configure scoring criteria and percentage weights (totaling 100%), score contestants, and submit official score sheets.
- `viewer` / Public: Read-only access to published events, official rankings, and the winner's podium at `/results`.

### Promoting the First Administrator:
When a new user registers through the `/register` page using their **Username** (e.g. `admin`), their account is initialized with `role: 'judge'` and `status: 'pending'`. To designate your first system administrator, run this query in your Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin', status = 'active'
where split_part(email, '@', 1) = 'your_username';
```

---

## 12. Verification & Testing Checklist

Follow this sequence to test full end-to-end functionality:

1. **Public View**: Open `/results` — verify published verdicts layout and brand header.
2. **Registration**: Navigate to `/register` — request an account. Verify validation on:
   - Full name (minimum 2 characters)
   - Unique Username (3–30 alphanumeric / underscore characters, e.g. `admin`)
   - Philippine mobile number (`+639...` or `09...`)
   - Strong password requirements
   - Unique Judge / Employee ID
3. **Admin Approval**: In Supabase SQL or as an existing Admin under `/app/judges`, approve the pending judge.
4. **Sign In**: Log into `/login` with active credentials.
5. **Create Competition**: Go to `/app/competitions` and create an academic year competition (e.g. `CCS Week 2026`).
6. **Seed / Add Events**: Go to `/app/events` and click **"Seed Official 6 Events"**.
7. **Assign Judges**: Go to `/app/assign-judges` and assign an active judge to an event.
8. **Register Contestants**: Go to `/app/contestants` and add participants assigned to that event.
9. **Configure Criteria**: As the assigned judge under `/app/criteria`:
   - Add criteria (e.g., Code Quality 40%, Efficiency 30%, Correctness 30%).
   - Verify that locking is blocked until total weight is **exactly 100%**.
   - Click **"Lock Criteria for Scoring"**.
10. **Scoring**: Go to `/app/scores`:
    - Verify maximum score validation.
    - Inspect real-time weighted score calculation.
    - Save draft scores.
    - Click **"Submit Official Score Sheet"**.
11. **Tabulation & Rankings**: Go to `/app/tabulation` or `/app/rankings` to view PostgreSQL-computed averages and rank placements.
12. **Finalize & Publish**: As an Administrator, click **"Finalize & Publish Verdicts"**.
13. **Public Verification**: Return to `/results` in an incognito window — confirm the official winner's podium and rankings are now visible to the public.

---

## 13. Security Policies

- **Row Level Security (RLS)** is enforced on all 14 database tables.
- **Judge Event Scoping**: Judges cannot view or submit scores for events they are not explicitly assigned to.
- **Immutable Scores**: Once a score sheet is submitted, database triggers prohibit updates unless explicitly reopened by an administrator.
- **Audit Logging**: Inserts, updates, and deletes on core tabulation entities trigger automatic JSON snapshots in `public.audit_logs`.

---

## 14. Troubleshooting

- **"Database connection pending" banner**: Ensure `.env.local` exists and contains valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **PowerShell `.ps1` execution error on Windows**: Run node scripts via `npx.cmd` or set your session policy: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.
- **`pnpm install` minimum release age warning**: If using pnpm 11, run `pnpm install --config.minimum-release-age=0` or use pnpm 10.34.3 specified in `.mise.toml`.
- **RLS Access Denied**: Verify that the user profile has `status = 'active'` in `public.profiles` and proper event assignments in `public.judge_event_assignments`.
- **Scores cannot be submitted**: Verify that all criteria weights total 100% and criteria are in a `locked` state prior to scoring.
