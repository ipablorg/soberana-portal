# Soberana Network — Member Portal

Static portal for the Soberana Network member pipeline: public seat application,
applicant status, and the internal review committee's evaluation board.

- **Stack:** hand-written HTML/CSS/ES modules, no bundler. Firebase (Firestore + email-link
  passwordless auth) via the Firebase JS SDK v10 from gstatic ESM (version pinned). See
  `orchestration/portal-firebase/C-003b-firebase-migration.md` in the HQ repository —
  the former Supabase data layer (`db/`) is kept archived as reference only.
- **Spec:** `docs/C-003-member-portal-spec.md` + `orchestration/portal-firebase/` in the HQ
  repository (`ipablorg/soberana-network-landing`, private); the wizard follows R-015.
- **Security posture:** the browser holds only the public `firebaseConfig` block. Every read
  and write is decided by `firestore.rules` (HQ `orchestration/portal-firebase/firestore.rules`):
  applicants see and submit only their own application with a verified email-link session;
  dimension weights, gates, scores, events and decisions are reviewer-only; admins alone
  record decisions and manage `reviewers`. Totals and the recommendation band (≥70 advance ·
  50–69 conditional · <50 decline) are computed in the reviewer client. No secrets exist in
  this repo — service accounts never belong here.

## Run locally

```bash
python3 -m http.server 8080
# → http://localhost:8080/
```

Before anything works, `assets/config.js` must contain the `firebaseConfig` block of the
`soberana_network` Firebase project (console → Project settings → Your apps → Web), with the
rules published and `dimensions`/`markets` seeded per C-003b §Setup.

## Structure

```
index.html            portal home
apply.html            application wizard (R-015: path guide, 5 steps, drafts, review)
submitted.html        confirmation + reference code
status.html           applicant sign-in (secure email link) + application timeline
review/index.html     committee sign-in + pipeline board (client-computed totals)
review/application.html  application detail: data, gates, worksheet, stage, decision, audit log
review/seats.html     seat registry (admin edits)
assets/               config, single Firebase client, pure scoring math, shared chrome, design system
tests/                bands unit test + emulator-only Firestore rules probes
db/                   archived Supabase SQL reference (no longer used)
```

## Deploy

GitHub Pages via Actions on push to `main` (`.github/workflows/pages.yml`). Feature branches are
merged by the orchestrator after QA. `ipablorg.github.io` must stay in the Firebase Auth
authorized domains so sign-in links resolve.
