# Soberana Network — Member Portal (Etapa 1)

Static portal for the Soberana Network member pipeline: public seat application,
applicant status, and the internal review committee's evaluation board.

- **Stack:** hand-written HTML/CSS/ES modules, no bundler. Supabase (Postgres + RLS + email OTP auth) via `@supabase/supabase-js@2` from jsDelivr ESM (version pinned).
- **Spec:** `docs/C-003-member-portal-spec.md` in the HQ repository (`ipablorg/soberana-network-landing`, private). This repo implements its Etapa 1.
- **Security posture:** the browser talks to Supabase with the anon key only; every read and write is decided by Row-Level Security plus two SECURITY DEFINER RPCs (`submit_application`, `set_application_status`). No secrets exist in this repo. Evaluation dimensions and their caps are seeded in the database only — the UI renders whatever the database returns.

## Run locally

```bash
python3 -m http.server 8080
# → http://localhost:8080/
```

Before anything works, `assets/config.js` must contain the project URL and anon key of the
Supabase project, and the SQL in `db/` (in order: `schema.sql` → `policies.sql` → `seed-public.sql`)
must have been run, followed by the private seed (kept out of this repository by design).

## Structure

```
index.html            portal home
apply.html            public application form (RPC-submitted)
submitted.html        confirmation + reference code
status.html           applicant sign-in (email OTP code or magic link) + application timeline
review/index.html     committee sign-in + pipeline board
review/application.html  application detail: data, gates, worksheet, stage, decision, audit log
review/seats.html     seat registry (admin edits)
assets/               config, single Supabase client, shared chrome, design system
db/                   SQL reference copies (structure and public seed)
```

## Deploy

GitHub Pages via Actions on push to `main` (`.github/workflows/pages.yml`). Feature branches are
merged by the orchestrator after QA.
