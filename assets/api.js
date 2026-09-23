/* Soberana Member Portal — single Firebase client + typed helpers
   (C-003b / D-019: Firestore + email-link auth replace Supabase; the export
   surface and return shapes are unchanged, so pages need no data-layer edits).
   SDK v10 pinned, ESM from the official CDN. Security lives entirely in
   firestore.rules — never here. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, sendSignInLinkToEmail,
  isSignInWithEmailLink, signInWithEmailLink, signOut as fbSignOut,
  connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, writeBatch,
  query, where, orderBy, serverTimestamp, Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig, CONFIGURED, EMULATOR } from './config.js';
import { computeTotals } from './scoring.js';

export const configured = CONFIGURED;

let auth = null;
let db = null;
if (CONFIGURED || EMULATOR) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  if (EMULATOR) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
  }
}

/* ---------- shared helpers ---------- */

// Firestore Timestamps are normalized to ISO strings so every page keeps using
// fmtDate()/new Date() exactly as with the SQL timestamps.
function toJs(value) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return value ?? null;
}
function docToJs(snap) {
  const out = { id: snap.id };
  for (const [k, v] of Object.entries(snap.data())) out[k] = v instanceof Timestamp ? toJs(v) : v;
  return out;
}
const rowsOf = async ref => (await getDocs(ref)).docs.map(docToJs);
const requireDb = () => { if (!db) throw new Error('backend-not-configured'); };

/** Resolves once Firebase Auth has settled the signed-in state (or absence). */
export function authReady() {
  if (!auth) return Promise.resolve(null);
  return new Promise(res => {
    const off = onAuthStateChanged(auth, user => { off(); res(user); });
  });
}

/* ---------- application (authenticated submit — C-003b) ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBMIT_KEYS = ['company', 'website', 'entity_class', 'country_code', 'market_other',
  'rails_operated', 'regulator', 'license_id', 'operating_role', 'tpv_band',
  'corridors_contribute', 'corridors_receive', 'contribution', 'contact_name'];

/** Mirrors firestore.rules on create: status='received', consent, contact_email ==
 *  token email, created_at = request.time, exact key set, ref generated client-side. */
export async function submitApplication(payload) {
  requireDb();
  // honeypot: silently accept and drop, same shape the former RPC returned
  if ((payload.company_web || '').trim() !== '') return { ok: true, ref: null };
  const user = auth?.currentUser;
  if (!user || !user.email) return { ok: false, error: 'unauthenticated' };
  const email = user.email.toLowerCase();
  const trim = v => (typeof v === 'string' ? v.trim() : '');
  // rules mirror → definitive 'invalid', identical to the former RPC verdict
  if (!trim(payload.company) || !trim(payload.contact_name) || payload.consent !== true
    || !EMAIL_RE.test(email) || trim(payload.contact_email).toLowerCase() !== email) {
    return { ok: false, error: 'invalid' };
  }
  const id = doc(collection(db, 'applications')).id; // client id → ref suffix
  const ref = `SN-${new Date().getFullYear()}-${id.slice(-4)}`;
  const fields = Object.fromEntries(SUBMIT_KEYS.map(k => [k, trim(payload[k])]));
  // a rules rejection (permission-denied) propagates: the caller renders the
  // uncertain state honestly instead of inventing a definitive verdict
  await setDoc(doc(db, 'applications', id), {
    ...fields,
    contact_email: email, // locked to the verified session (rules re-check it)
    consent: true,
    ref, status: 'received', outcome: null, source: 'portal',
    created_at: serverTimestamp(),
  });
  return { ok: true, id, ref };
}

export async function fetchMarkets() {
  requireDb();
  const rows = await rowsOf(collection(db, 'markets'));
  return rows.sort((a, b) => String(a.code).localeCompare(String(b.code)));
}

/* ---------- auth: email-link (passwordless) — C-003b ---------- */

const EMAIL_KEY = 'soberana.signInEmail'; // remembered so the return link can complete sign-in

/** Sends the secure sign-in link; the email is stored for the return trip.
 *  Stale sign-in params (oobCode…) are stripped from the continueUrl so a
 *  leftover code can never shadow the fresh one on return. */
export async function sendSignInLink(email, url) {
  requireDb();
  const clean = new URL(url);
  for (const k of [...clean.searchParams.keys()]) {
    if (k !== 'id' && k !== 'ref') clean.searchParams.delete(k);
  }
  await sendSignInLinkToEmail(auth, email, { url: clean.href, handleCodeInApp: true });
  try { localStorage.setItem(EMAIL_KEY, email); } catch { /* cross-device return asks for the email */ }
  return { error: null };
}

export function isSignInWithEmailLinkUrl() {
  return !!auth && isSignInWithEmailLink(auth, window.location.href);
}

/** Exchanges an explicit oob code + email for a session (tests / manual returns). */
export async function signInWithEmailLinkCode(email, url) {
  requireDb();
  return signInWithEmailLink(auth, email, url);
}

/** Completes the sign-in link return: signs in, clears the one-time params.
 *  Never throws: a cross-device return (no remembered email) or an expired code
 *  returns false with the URL intact so the applicant can retry by re-entering
 *  the email — the pages route that case through signInWithEmailLinkCode(). */
export async function completeSignIn() {
  if (!isSignInWithEmailLinkUrl()) return false;
  let email = null;
  try { email = localStorage.getItem(EMAIL_KEY); } catch { /* absent → cross-device return */ }
  try {
    await signInWithEmailLink(auth, email ?? undefined, window.location.href);
  } catch {
    return false;
  }
  try { localStorage.removeItem(EMAIL_KEY); } catch { /* nothing stored */ }
  const keep = new URLSearchParams(window.location.search);
  const rest = new URLSearchParams();
  for (const k of ['id', 'ref']) if (keep.has(k)) rest.set(k, keep.get(k));
  history.replaceState(null, '', window.location.pathname + (rest + '' ? `?${rest}` : ''));
  return true;
}

export async function currentUser() {
  return auth?.currentUser ?? null;
}

export async function userEmail() {
  return auth?.currentUser?.email ?? null;
}

export async function signOut() {
  if (auth) await fbSignOut(auth);
}

/* ---------- applicant ---------- */

/** The applicant's own applications (rules: contact_email == token email). */
export async function myApplications(email) {
  requireDb();
  const rows = await rowsOf(query(
    collection(db, 'applications'),
    where('contact_email', '==', String(email).toLowerCase()),
  ));
  return rows.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

/* ---------- reviewer ---------- */

/** reviewers/{uid}: null → no access. Bootstrap happens in the Firebase console. */
export async function myReviewerRow() {
  requireDb();
  const user = auth?.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'reviewers', user.uid));
  return snap.exists() ? docToJs(snap) : null;
}

/** Board payload. Totals/band are computed here (former v_application_totals)
 *  from gates + scores + dimensions; stage-change events live in detail pages. */
export async function boardData() {
  requireDb();
  const [apps, dimensions] = await Promise.all([
    rowsOf(query(collection(db, 'applications'), orderBy('created_at', 'asc'))),
    fetchDimensions(),
  ]);
  const perApp = await Promise.all(apps.map(async a => {
    const [gates, scores] = await Promise.all([
      rowsOf(collection(db, 'applications', a.id, 'gates')),
      rowsOf(collection(db, 'applications', a.id, 'scores')),
    ]);
    // missing gate docs count as pending — same normalization as fetchGates(),
    // so the board and the detail page always agree
    return [a.id, computeTotals({ gates: gateRows(gates), scores, dimensions })];
  }));
  return { apps, gates: [], totals: Object.fromEntries(perApp), events: [] };
}

export async function fetchApplication(id) {
  requireDb();
  const snap = await getDoc(doc(db, 'applications', id));
  return snap.exists() ? docToJs(snap) : null;
}

const GATE_CODES = ['D1_license', 'D1_funds_flow', 'D4_sandbox', 'D5_program', 'D6_live_flows'];

/** The five known gates in fixed order; fresh submissions have no gate docs yet
 *  (rules reserve their creation to reviewers), so pending defaults fill in. */
function gateRows(rows) {
  const have = new Map(rows.map(r => [r.id, r]));
  return GATE_CODES.map(code => {
    const r = have.get(code);
    return r ? { ...r, gate_code: code } : { gate_code: code, result: 'pending', note: null };
  });
}

export async function fetchGates(appId) {
  requireDb();
  return gateRows(await rowsOf(collection(db, 'applications', appId, 'gates')));
}

/** Reviewer upserts gate results and appends the audit event (append-only per rules). */
export async function saveGates(rows) {
  requireDb();
  const uid = auth?.currentUser?.uid ?? null;
  try {
    const batch = writeBatch(db);
    for (const r of rows) {
      batch.set(doc(db, 'applications', r.application_id, 'gates', r.gate_code), {
        result: r.result,
        note: r.note ?? null,
        decided_by: uid,
        decided_at: serverTimestamp(),
      });
      batch.set(doc(collection(db, 'applications', r.application_id, 'events')), {
        actor: uid, event: 'gate', detail: `${r.gate_code}: ${r.result}${r.note ? ` — ${r.note}` : ''}`,
        created_at: serverTimestamp(),
      });
    }
    await batch.commit();
    return null;
  } catch (e) { return e; }
}

export async function fetchDimensions() {
  requireDb();
  const rows = await rowsOf(query(collection(db, 'dimensions'), orderBy('sort', 'asc')));
  return rows.map(r => ({ code: r.id, ...r }));
}

export async function fetchScores(appId) {
  requireDb();
  const rows = await rowsOf(collection(db, 'applications', appId, 'scores'));
  return rows.map(r => ({ ...r, dimension_code: r.id }));
}

/** points > weight is rejected by firestore.rules — surfaced as the returned error. */
export async function saveScores(rows) {
  requireDb();
  const uid = auth?.currentUser?.uid ?? null;
  try {
    const batch = writeBatch(db);
    for (const r of rows) {
      batch.set(doc(db, 'applications', r.application_id, 'scores', r.dimension_code), {
        points: r.points,
        note: r.note ?? null,
        scored_by: uid,
        updated_at: serverTimestamp(),
      });
      batch.set(doc(collection(db, 'applications', r.application_id, 'events')), {
        actor: uid, event: 'score', detail: `${r.dimension_code}: ${r.points} pts`,
        created_at: serverTimestamp(),
      });
    }
    await batch.commit();
    return null;
  } catch (e) { return e; }
}

/** Totals + band recomputed client-side from gates, scores and dimension weights. */
export async function fetchTotals(appId) {
  requireDb();
  const [gates, scores, dimensions] = await Promise.all([
    fetchGates(appId), fetchScores(appId), fetchDimensions(),
  ]);
  return computeTotals({ gates, scores, dimensions });
}

export async function fetchDecision(appId) {
  requireDb();
  const snap = await getDoc(doc(db, 'applications', appId, 'decisions', 'decision'));
  return snap.exists() ? docToJs(snap) : null;
}

/** Admin records the formal decision: decision doc + neutral applicant outcome
 *  + audit event, atomically (C-003b: the reviewer client writes the events). */
export async function recordDecision(row) {
  requireDb();
  const uid = auth?.currentUser?.uid ?? null;
  const appId = row.application_id;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'applications', appId, 'decisions', 'decision'), {
      outcome: row.outcome,
      rationale: row.rationale,
      conditions: row.conditions ?? null,
      board_ref: row.board_ref ?? null,
      decided_by: uid,
      decided_at: serverTimestamp(),
    });
    batch.update(doc(db, 'applications', appId), { status: 'decided', outcome: row.outcome });
    batch.set(doc(collection(db, 'applications', appId, 'events')), {
      actor: uid, event: 'decision', detail: `${row.outcome}: ${row.rationale}`,
      created_at: serverTimestamp(),
    });
    await batch.commit();
    return null;
  } catch (e) { return e; }
}

/** Reviewer moves the pipeline stage (rules: status key only) + audit event,
 *  atomically — a stage change never lands without its log entry. */
export async function setStatus(appId, newStatus, note) {
  requireDb();
  const uid = auth?.currentUser?.uid ?? null;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'applications', appId), { status: newStatus });
    batch.set(doc(collection(db, 'applications', appId, 'events')), {
      actor: uid, event: 'status_change', detail: `→ ${newStatus}${note ? `: ${note}` : ''}`,
      created_at: serverTimestamp(),
    });
    await batch.commit();
    return null;
  } catch (e) { return e; }
}

export async function fetchEvents(appId) {
  requireDb();
  return rowsOf(query(collection(db, 'applications', appId, 'events'), orderBy('created_at', 'asc')));
}

export async function addEventNote(appId, detail) {
  requireDb();
  const uid = auth?.currentUser?.uid ?? null;
  try {
    await addDoc(collection(db, 'applications', appId, 'events'), {
      actor: uid, event: 'note', detail, created_at: serverTimestamp(),
    });
    return null;
  } catch (e) { return e; }
}

/* ---------- seats ---------- */

export async function fetchSeats() {
  return fetchMarkets();
}

export async function saveSeat(row) {
  requireDb();
  try {
    await updateDoc(doc(db, 'markets', row.code), {
      seat_total: row.seat_total, seats_allocated: row.seats_allocated, live: row.live,
    });
    return null;
  } catch (e) { return e; }
}
