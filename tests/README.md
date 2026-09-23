# Tests (C-003b — C-003 §9 re-read as Firebase probes)

## 1. Bands + totals math (no dependencies)

```bash
node tests/bands.mjs
```

Asserts the client-side computation that replaced `v_application_totals`:
C-001 worked examples (72 → advance, 55 → conditional, 45 → decline), the exact
70/50 band edges, and the blocked states (gate failed / gate pending / missing
dimension → band `null` with counters intact).

## 2. Firestore rules probes (emulator only — never against production)

```bash
# one-time: Firebase CLI + a Java runtime are needed for the emulators
npx firebase emulators:start --project demo-soberana

# second terminal — serve the repo (8080 is taken by the Firestore emulator)
python3 -m http.server 8088
# → open http://localhost:8088/tests/rules-probe.html?emulator=1
```

The page runs the **real adapter** (`assets/api.js`, `?emulator=1` wires the
SDK to the Auth/Firestore emulators) and drives these probes:

| # | Probe (C-003 §9 parity) |
|---|---|
| P0 | Anonymous `applications` list denied |
| P1 | Authenticated applicant submits through the adapter; ref matches `SN-YYYY-XXXX` |
| P2 | Applicant sees exactly her own application document |
| P3 | Non-reviewer reads **0 docs** from `dimensions`, and from her own app's `gates`/`scores`; cannot write `events` |
| P4 | A second applicant sees 0 of the first one's docs; cannot read her doc; `contact_email ≠ token email` create rejected |
| P5 | Reviewer: weights readable; `points > weight` rejected by rules; `points ≤ weight` accepted |
| P6 | Non-admin `decisions` write denied |
| P7 | `events` immutable once written (append-only) |
| P8 | Bands 72→advance · 55→conditional · 45→decline (client-side) |

Seeding uses the emulator's admin bypass (`Authorization: Bearer owner` on the
Firestore emulator REST API); sign-ins use the Auth emulator oob-code inbox, so
the email-link round trip is exercised end to end. A reviewer row is created for
the probe reviewer on the fly.
