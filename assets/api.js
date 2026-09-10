/* Soberana Member Portal — single Supabase client + typed helpers (C-003 §1, B-008 rule 1) */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, CONFIGURED } from './config.js';

export const sb = CONFIGURED ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
export const configured = CONFIGURED;

/* ---------- application (anon, via RPC — never a direct INSERT) ---------- */

export async function submitApplication(payload) {
  const { data, error } = await sb.rpc('submit_application', { payload });
  if (error) throw error;
  return data; // {ok, ref?, id?, error?: 'rate_limited'|'invalid'}
}

export async function fetchMarkets() {
  const { data, error } = await sb.from('markets').select('*').order('code');
  if (error) throw error;
  return data ?? [];
}

/* ---------- auth: BOTH OTP variants (6-digit code + magic link) ---------- */

/** Sends the email containing the 6-digit code. */
export async function sendLoginCode(email, redirectTo) {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  return { error };
}

/** Sends the email containing the magic link back to `redirectTo` (same page). */
export async function sendMagicLink(email, redirectTo) {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });
  return { error };
}

/** Verifies the 6-digit code (OTP email type). */
export async function verifyLoginCode(email, token) {
  const { data, error } = await sb.auth.verifyOtp({ email, token: token.trim(), type: 'email' });
  return { session: data?.session ?? null, error };
}

export async function currentUser() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data?.session?.user ?? null;
}

export async function userEmail() {
  return (await currentUser())?.email ?? null;
}

export async function signOut() {
  await sb.auth.signOut();
}

/** True when the URL hash carries magic-link tokens (handled automatically by supabase-js). */
export function hasMagicLinkHash() {
  return /access_token|error=/.test(window.location.hash);
}

/* ---------- applicant ---------- */

export async function myApplications(email) {
  const { data, error } = await sb
    .from('applications')
    .select('id,ref,status,company,country_code,market_other,entity_class,created_at')
    .ilike('contact_email', email)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function myDecision(appId) {
  const { data, error } = await sb.from('decisions').select('outcome,decided_at').eq('application_id', appId).maybeSingle();
  if (error) throw error;
  return data;
}

/* ---------- reviewer ---------- */

export async function myReviewerRow() {
  const { data, error } = await sb.from('reviewers').select('role,active,email').eq('user_id', (await currentUser()).id).maybeSingle();
  if (error) throw error;
  return data; // null → no access
}

export async function boardData() {
  const [apps, gates, totals, events] = await Promise.all([
    sb.from('applications').select('id,ref,status,company,country_code,market_other,entity_class,created_at,contact_email').order('created_at', { ascending: false }),
    sb.from('application_gates').select('application_id,gate_code,result'),
    sb.from('v_application_totals').select('application_id,gates_failed,gates_pending,total_points,max_points,band'),
    sb.from('pipeline_events').select('application_id,event,created_at').eq('event', 'status_change').order('created_at'),
  ]);
  for (const q of [apps, gates, totals, events]) if (q.error) throw q.error;
  return { apps: apps.data ?? [], gates: gates.data ?? [], totals: totals.data ?? [], events: events.data ?? [] };
}

export async function fetchApplication(id) {
  const { data, error } = await sb.from('applications').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchGates(appId) {
  const { data, error } = await sb.from('application_gates').select('*').eq('application_id', appId);
  if (error) throw error;
  const order = ['D1_license', 'D1_funds_flow', 'D4_sandbox', 'D5_program', 'D6_live_flows'];
  return (data ?? []).sort((a, b) => order.indexOf(a.gate_code) - order.indexOf(b.gate_code));
}

export async function saveGates(rows) {
  // trigger trg_log_gate stamps decided_by/at and writes the audit event
  const { error } = await sb.from('application_gates').upsert(rows, { onConflict: 'application_id,gate_code' });
  return error;
}

export async function fetchDimensions() {
  // dimensions and their caps live only in the database — the UI renders what it returns
  const { data, error } = await sb.from('scoring_dimensions').select('*').order('sort');
  if (error) throw error;
  return data ?? [];
}

export async function fetchScores(appId) {
  const { data, error } = await sb.from('application_scores').select('*').eq('application_id', appId);
  if (error) throw error;
  return data ?? [];
}

export async function saveScores(rows) {
  // trigger trg_cap_score stamps scored_by and rejects over-cap values
  const { error } = await sb.from('application_scores').upsert(rows, { onConflict: 'application_id,dimension_code' });
  return error;
}

export async function fetchTotals(appId) {
  const { data, error } = await sb.from('v_application_totals').select('*').eq('application_id', appId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchDecision(appId) {
  const { data, error } = await sb.from('decisions').select('*').eq('application_id', appId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function recordDecision(row) {
  // trigger trg_log_decision stamps decided_by, flips status to decided, logs the event
  const { error } = await sb.from('decisions').insert(row);
  return error;
}

export async function setStatus(appId, newStatus, note) {
  const { error } = await sb.rpc('set_application_status', { app_id: appId, new_status: newStatus, note: note || null });
  return error;
}

export async function fetchEvents(appId) {
  const { data, error } = await sb.from('pipeline_events').select('*').eq('application_id', appId).order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addEventNote(appId, detail) {
  const { error } = await sb.from('pipeline_events').insert({ application_id: appId, event: 'note', detail });
  return error;
}

export async function fetchSeats() {
  const { data, error } = await sb.from('markets').select('*').order('code');
  if (error) throw error;
  return data ?? [];
}

export async function saveSeat(row) {
  const { error } = await sb.from('markets').update({
    seat_total: row.seat_total, seats_allocated: row.seats_allocated, live: row.live,
  }).eq('code', row.code);
  return error;
}
