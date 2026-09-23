/* Soberana Member Portal — shared chrome: header, footer, banner, toast, timeline (C-003 §8.1) */

export const FOOTER_DISCLAIMER =
  'A <img class="lpy" src="ASSETSloopay-logo-white.png" alt="Loopay"> spin-off. Verified figures carry public sources; illustrative figures are placeholders. This page is an invitation to inquire only — it is not an offer of securities; any offer is made solely through definitive documents provided to eligible recipients in permitted jurisdictions.';

/** Renders header + footer. `depth` = number of directory levels from repo root (0 root, 1 inside review/). */
export function chrome({ active = '', depth = 0, internal = false } = {}) {
  const A = '../'.repeat(depth);
  const NET = 'https://soberana.network/';
  const link = (href, label, key) =>
    `<a href="${A}${href}" class="${active === key ? 'on' : ''}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
  const btn = (href, label, key) =>
    `<a href="${A}${href}" class="btn sm ${active === key ? 'on' : ''}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
  const nav = internal
    ? `${link('review/index.html', 'Pipeline', 'pipeline')}${link('review/seats.html', 'Seat Registry', 'seats')}${link('index.html', 'Member Portal', 'public')}<a href="#" id="nav-signout">Sign Out</a>`
    : `${link('index.html', 'Member Portal', 'home')}${btn('apply.html', 'Apply', 'apply')}${link('status.html', 'Application Status', 'status')}`;
  // public resource set; portal-local routes use the depth prefix, network destinations are absolute
  const resources = withReviewer =>
    `<nav class="resource-links" aria-label="Network Links"><a href="${NET}">Network Home</a><a href="${A}index.html">Member Portal</a><a href="${A}status.html">Application Status</a><a href="${NET}manifesto.html">Founding Charter</a><a href="${NET}member-brief.pdf" target="_blank" rel="noopener noreferrer">Member Brief (PDF)</a><a href="https://sandbox.soberana.loopay.com/docs" target="_blank" rel="noopener noreferrer">API Docs</a>${withReviewer ? `<a href="${A}review/index.html">Reviewer Sign-In</a>` : ''}</nav>`;
  const foot = internal
    ? `<div class="foot"><div class="wrap">${resources(false)}</div></div>`
    : `<div class="foot"><div class="wrap">${FOOTER_DISCLAIMER.replaceAll('ASSETS', A)}${resources(true)}</div></div>`;
  document.getElementById('site-header').innerHTML =
    `<div class="hdr"><div class="wrap hdr-in"><a class="brand" href="${NET}" aria-label="Network Home">SOBERANA<b>.NETWORK</b></a><nav>${nav}</nav></div></div>`;
  document.getElementById('site-footer').outerHTML = `<div id="site-footer">${foot}</div>`;
  const so = document.getElementById('nav-signout');
  if (so) so.addEventListener('click', async e => {
    e.preventDefault();
    const { signOut } = await import('./api.js');
    await signOut();
    window.location.href = A + 'index.html';
  });
}

/** Shows the "not configured" banner until Pablo fills assets/config.js. Returns true when blocked. */
export function configBanner() {
  const el = document.getElementById('config-banner');
  if (!el) return false;
  el.classList.add('show');
  return true;
}

let toastTimer;
export function toast(msg, bad = false) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.toggle('bad', bad);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}

export const STAGES = ['received', 'screening', 'scoring', 'committee', 'decided'];
export const STAGE_LABELS = {
  received: 'Received', screening: 'Screening', scoring: 'Scoring', committee: 'Committee', decided: 'Decision',
};

/** Five-step timeline; `status` is one of STAGES. */
export function timeline(status) {
  const cur = STAGES.indexOf(status);
  return `<div class="timeline">${STAGES.map((s, i) =>
    `<div class="tl-step ${i < cur ? 'done' : ''} ${i === cur ? 'cur' : ''}">${STAGE_LABELS[s]}</div>`).join('')}</div>`;
}

/** Neutral, applicant-safe decision language (C-003 §7 — verbatim lines). */
export function decisionLine(outcome) {
  return {
    advance: 'Advanced to committee recommendation.',
    conditional: 'Conditional — remediation plan agreed.',
    decline: 'Not eligible at this time (re-apply after 6 months).',
    sponsored_route: 'Routed to the sponsored tier. The network will contact you.',
  }[outcome] || '';
}

export function marketName(app, markets) {
  if (app.country_code) return markets.find(m => m.code === app.country_code)?.name || app.country_code;
  return app.market_other || '—';
}

export function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

export function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/* ==================================================================
   Apply v2 (R-015) — presentation only. Inert unless apply.html calls
   initApply() or submitted.html calls readReceipt(). No network helper,
   Firebase client or schema code lives here.
   ================================================================== */

const ROLES = ['Payments', 'Remittances', 'Payroll', 'Wallet', 'PSP', 'Bank', 'Other'];
const TPV_BANDS = ['under US$1M', 'US$1–10M', 'US$10–50M', 'over US$50M'];
const GUIDE_MARKETS = ['Colombia', 'Mexico', 'Brazil', 'United States', 'Ecuador', 'Peru', 'Other'];
const ENTITIES = [
  { value: 'founding', label: 'Licensed fintech or PSP' },
  { value: 'institutional', label: 'Bank or regulated financial institution' },
  { value: 'sponsored', label: 'Unlicensed business with distribution' },
];
const ENTITY_LABELS = Object.fromEntries(ENTITIES.map(e => [e.value, e.label]));

const APPLY = {
  DRAFT_KEY: 'soberana.apply.v2.draft',
  ATTEMPT_KEY: 'soberana.apply.v2.attempt',
  RECEIPT_KEY: 'soberana.apply.v2.receipt',
  VERSION: 2,
  TTL_MS: 7 * 864e5,
  RECEIPT_TTL_MS: 24 * 3600e3,
  DEBOUNCE_MS: 500,
  ROLES,
  GUIDE_MARKETS,
  ENTITIES,
  TPV: TPV_BANDS,
  STEP_NAMES: ['Company', 'Market & permissions', 'Scale & corridors', 'Contact & consent', 'Review & submit'],
  LIB: {
    roadmap: ['Read the Legal Roadmap', 'https://soberana.network/legal-roadmap.pdf'],
    mou: ['Read the MOU Guide', 'https://soberana.network/legal-mou.pdf'],
    standards: ['Read Membership Standards & Compliance', 'https://soberana.network/legal-membership-framework.pdf'],
    definitive: ['Read Definitive Agreements Overview', 'https://soberana.network/legal-definitive-agreements.pdf'],
    markets: ['Read Markets & Regulatory Landscape', 'https://soberana.network/markets-regulatory-landscape.pdf'],
    criteria: ['Read Membership Criteria Overview', 'https://soberana.network/membership-criteria-overview.pdf'],
  },
  // key → {id, step, required, check, error}; document order of the object is validation order
  FIELDS: {
    company: { id: 'f-company', step: 1, required: true, error: 'Enter the legal company name.' },
    website: { id: 'f-website', step: 1, check: 'website', error: 'Enter a valid company website beginning with http:// or https://.' },
    entity_class: { id: 'f-entity', step: 1, required: true, enums: ['founding', 'institutional', 'sponsored'], error: 'Choose an entity class.' },
    country_code: { id: 'f-country', step: 2, market: true, error: 'Choose a main market.' },
    market_other: { id: 'f-market-other', step: 2, other: true, error: 'Enter your market.' },
    rails_operated: { id: 'f-rails', step: 2, required: true, error: 'Describe the rails you operate on, or state that you do not currently operate on a rail.' },
    regulator: { id: 'f-regulator', step: 2 },
    license_id: { id: 'f-license-id', step: 2 },
    operating_role: { id: 'f-role', step: 3, required: true, enums: ROLES, error: 'Choose an operating role.' },
    tpv_band: { id: 'f-tpv', step: 3, required: true, enums: TPV_BANDS, error: 'Choose a monthly TPV band.' },
    corridors_contribute: { id: 'f-corr-out', step: 3 },
    corridors_receive: { id: 'f-corr-in', step: 3 },
    contribution: { id: 'f-contribution', step: 3 },
    contact_name: { id: 'f-contact', step: 4, required: true, error: 'Enter the contact name.' },
    contact_email: { id: 'f-email', step: 4, required: true, check: 'email', error: 'Enter a valid email address.' },
  },
  DRAFT_FIELDS: null, // set below
  STALE_MARKET: 'Your saved market is no longer in the available list. Choose a market or select Other.',
  MARKET_LOAD_FAIL: 'We could not load the market list. Try again or choose Other and name your market.',
  SIDEBAR: {
    1: { stage: 'Legal Roadmap · Inquiry', body: 'First, reviewers need to understand which entity is applying and what it does. Submitting this form begins an inquiry; it does not reserve a seat.', evidence: 'Prepare later: entity identity, an activity map and accountable contacts.', links: ['roadmap', 'criteria'] },
    2: { stage: 'Legal Roadmap · Eligibility review', body: 'Permissions are examined against the activities and entities in the proposed path. Required legal authorization cannot be replaced by commercial interest.', evidence: 'Prepare later: regulator references, authorization scope and the entities responsible for each activity.', links: ['criteria', 'markets'] },
    3: { stage: 'Legal Roadmap · Restricted diligence, if the inquiry advances', body: 'Specialist review examines whether evidence supports the proposed scope. A memorandum of understanding may organize that work; it does not create an investment commitment.', evidence: 'Prepare later: a route-level operating explanation, financial information, compliance controls and technical readiness evidence.', links: ['mou', 'standards'] },
    4: { stage: 'Legal Roadmap · Coordinating the review', body: 'The contact helps reviewers reach the people responsible for permissions, controls and operations. If review advances, evidence is shared through an agreed controlled channel.', evidence: 'Prepare later: the names of colleagues who can answer legal, compliance, treasury and technical questions.', links: ['mou', 'roadmap'] },
    5: { stage: 'Legal Roadmap · Review before any agreement', body: 'If the inquiry advances, the process may include an MOU, restricted diligence and definitive agreements before operational onboarding. Each stage has its own review and approvals.', evidence: 'Prepare later: evidence supporting the agreed scope. No upload or signature is requested here.', links: ['roadmap', 'definitive'] },
  },
};
APPLY.DRAFT_FIELDS = Object.keys(APPLY.FIELDS);

/** Pure pre-check decision (§3). Any missing/invalid input → { route: null }. Role never upgrades the route. */
export function decidePath(answer) {
  const a = answer || {};
  const entity = APPLY.ENTITIES.find(e => e.value === a.entityClass)?.value || null;
  const market = APPLY.GUIDE_MARKETS.includes(a.market) ? a.market : null;
  const role = APPLY.ROLES.includes(a.role) ? a.role : null;
  if (!entity || !market || !role) return { route: null, entity, market, role };
  // sponsored-first: an unlicensed business selecting Bank stays sponsored, never own-seat
  const route = entity === 'sponsored' ? 'sponsored' : entity;
  return { route, entity, market, role };
}

const GUIDE_COPY = {
  heading: 'Check your path',
  description: 'See a possible review path and the evidence to prepare. This guide does not save or send your answers.',
  boundary: 'This is guidance only. It does not verify eligibility, reserve a seat or guarantee admission. Every application is subject to review.',
  empty: 'Choose an entity class, a main market and an operating role to see a possible review path.',
  label: 'Based on your answers — not verified',
  q1: 'How would you describe the applying entity?',
  q1Helper: 'Choose the legal entity that would apply, not its parent or a service provider.',
  q2: 'What is your main market?',
  q2Helper: 'Market context does not establish permission to perform an activity.',
  q3: 'What is your main operating role?',
  q3Helper: 'Describe the activity you perform today. This answer does not verify authorization.',
  titles: { founding: 'Founding-seat review path', institutional: 'Institutional review path', sponsored: 'Sponsored participation path' },
  bodies: {
    founding: 'Your self-description points to the founding-seat review path. Review examines the applying entity\'s permissions, existing activity and proposed contribution. No seat is reserved by this guide or by submitting an application.',
    institutional: 'Your self-description points to the institutional review path. Review examines the applying institution\'s permissions, operating capabilities and proposed role. This result is not an admission decision.',
    sponsored: 'The sponsored path is for participation under a licensed member\'s seat, without a seat of your own. Sponsorship, permissions and operating scope require review; this guide does not identify or secure a sponsor.',
  },
  bankNote: 'The role you selected does not establish regulated status. Describe the entity\'s actual permissions in the application.',
  evHeading: 'Prepare for a later evidence review',
  evLead: 'You do not upload evidence in this application. Keep records with their source, date and relevant legal entity. We may request evidence through an agreed controlled channel if the inquiry advances.',
  lists: {
    founding: [
      'The applying entity\'s legal identity and regulator registry reference.',
      'An activity map showing which entity performs each step and under what permission.',
      'A summary of existing payment activity and the corridors you could contribute.',
      'Financial information and an explanation of settlement responsibilities.',
      'Named compliance and technical contacts, with a summary of controls and security evidence.',
    ],
    institutional: [
      'The applying institution\'s legal identity and current authorization scope.',
      'An activity map identifying clearing, settlement and other operating responsibilities.',
      'Evidence of institutional capacity and the capabilities you propose to contribute.',
      'Financial information relevant to the proposed operating role.',
      'Named compliance and technical contacts, with a summary of controls and security evidence.',
    ],
    sponsored: [
      'The applying business\'s legal identity and a description of its distribution.',
      'An activity map distinguishing your role from the licensed member\'s role.',
      'Any existing licensed-member relationship, clearly identified as confirmed or still under discussion.',
      'A summary of technical and security readiness.',
      'A named compliance contact and a summary of financial-crime controls.',
    ],
  },
  evFooter: 'Permissions are assessed activity by activity. A route suggestion is not permission to operate.',
  roleMod: {
    activity: 'In your activity map, identify who receives funds, holds balances and performs payouts, where relevant.',
    bank: 'In your activity map, identify the institution responsible for each proposed clearing or settlement activity.',
    other: 'In your activity map, describe the activity in plain language and identify the entities responsible for it.',
  },
  marketMod: m => `Review the dated market background for ${m}. It does not verify your entity's permissions.`,
  marketOther: 'The public market guide does not cover every jurisdiction. Name your market in the application; the applicable permissions require a separate review.',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pure payload assembly (§7): exactly the 17 allowed keys, trimmed, Other never double-serialized. */
export function buildPayload(v) {
  const val = v || {};
  const t = k => (typeof val[k] === 'string' ? val[k].trim() : '');
  const other = t('country_code') === '__other';
  return {
    company: t('company'),
    website: t('website'),
    entity_class: t('entity_class'),
    country_code: other ? '' : t('country_code'),
    market_other: other ? t('market_other') : '',
    rails_operated: t('rails_operated'),
    regulator: t('regulator'),
    license_id: t('license_id'),
    operating_role: t('operating_role'),
    tpv_band: t('tpv_band'),
    corridors_contribute: t('corridors_contribute'),
    corridors_receive: t('corridors_receive'),
    contribution: t('contribution'),
    contact_name: t('contact_name'),
    contact_email: t('contact_email'),
    consent: val.consent === true,
    company_web: t('company_web'),
  };
}

/** Pure validation (§7): returns [{key, message}] in document order. Empty optional fields are valid. */
export function validateValues(v, { staleMarket = false } = {}) {
  const val = v || {};
  const t = k => (typeof val[k] === 'string' ? val[k].trim() : '');
  const errors = [];
  for (const [key, f] of Object.entries(APPLY.FIELDS)) {
    if (f.market) continue; // market pair handled together below
    if (f.other) continue;
    const raw = t(key);
    if (f.required && !raw) { errors.push({ key, message: f.error }); continue; }
    if (!raw) continue;
    if (f.enums && !f.enums.includes(raw)) errors.push({ key, message: f.error });
    if (f.check === 'email' && !EMAIL_RE.test(raw)) errors.push({ key, message: f.error });
    if (f.check === 'website' && !isHttpUrl(raw)) errors.push({ key, message: f.error });
  }
  const country = t('country_code');
  if (!country) errors.push({ key: 'country_code', message: APPLY.FIELDS.country_code.error });
  else if (country === '__other' && !t('market_other')) errors.push({ key: 'market_other', message: APPLY.FIELDS.market_other.error });
  if (staleMarket) errors.push({ key: 'country_code', message: APPLY.STALE_MARKET });
  return errors;
}

function isHttpUrl(raw) {
  try {
    const u = new URL(raw);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch { return false; }
}

/** `SN-YYYY-XXXX` family — 4-digit year, 4+ alphanumeric characters (refs suffix
 *  the client-generated Firestore doc id, which mixes letters and digits). */
export function isValidRef(ref) {
  return typeof ref === 'string' && /^SN-\d{4}-[0-9A-Za-z]{4,}$/.test(ref);
}

const el = id => document.getElementById(id);
const setTxt = (node, text) => { node.textContent = text; };
/** HTML-escapes untrusted values for template interpolation (applicant input is
 *  attacker-controlled on reviewer pages — every interpolated field goes here). */
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function libLink([label, href]) {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = `${label} (PDF, opens in new tab)`;
  return a;
}
function announce(node, msg) { setTxt(node, msg); }

/* ---------- draft store: single versioned record, allowlisted, 7-day expiry ---------- */

function draftPurgeRaw() {
  try { localStorage.removeItem(APPLY.DRAFT_KEY); return true; } catch { return false; }
}

/** Reads + validates the draft record. Invalid/expired records are purged and null is returned. */
export function readDraft(now = Date.now()) {
  let raw = null;
  try { raw = localStorage.getItem(APPLY.DRAFT_KEY); } catch { return null; }
  if (!raw) return null;
  const drop = () => { draftPurgeRaw(); return null; };
  let rec;
  try { rec = JSON.parse(raw); } catch { return drop(); }
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return drop();
  const { version, createdAt, updatedAt, step, fields } = rec;
  if (version !== APPLY.VERSION) return drop();
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) return drop();
  if (createdAt > now || updatedAt > now) return drop(); // refuse future / untrustworthy clock
  if (!Number.isInteger(step) || step < 1 || step > 5) return drop();
  if (now - createdAt > APPLY.TTL_MS) return drop();
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return drop();
  const out = {};
  for (const key of APPLY.DRAFT_FIELDS) {
    const v = fields[key];
    if (v === undefined || v === null) { out[key] = ''; continue; }
    if (typeof v !== 'string') return drop();
    out[key] = v; // unknown keys are never preserved
  }
  for (const key of Object.keys(APPLY.FIELDS)) {
    const enums = APPLY.FIELDS[key].enums;
    if (enums && out[key] && !enums.includes(out[key])) return drop();
  }
  return { createdAt, updatedAt, step, fields: out };
}

function writeDraft(fields, step) {
  const now = Date.now();
  let prev = null;
  try { prev = readDraft(now); } catch { prev = null; }
  const rec = { version: APPLY.VERSION, createdAt: prev?.createdAt ?? now, updatedAt: now, step, fields };
  try {
    localStorage.setItem(APPLY.DRAFT_KEY, JSON.stringify(rec));
    return { ok: true, at: now };
  } catch { return { ok: false }; }
}

/* ---------- initApply: the wizard controller (apply.html only) ---------- */

export function initApply({ submitApplication, fetchMarkets, configured, getSessionEmail, sendSignInLink, verifiedReturn = false }) {
  if (el('apply-form')?.dataset.v2 === 'on') return; // idempotent
  const form = el('apply-form');
  if (!form) return;
  form.dataset.v2 = 'on';

  const S = {
    step: 1, entry: true, reviewReturn: false, readOnly: false,
    markets: [], marketState: 'idle', staleMarket: false,
    optIn: false, draftOk: true, savedAt: null, gen: 0, timer: 0,
    conflict: false, submitted: false, submitting: false, uncertain: false,
    pendingStart: false, sideOpen: true, session: null,
  };
  const $ = id => el(id);
  const val = id => ($(id)?.value ?? '');
  const fields = () => {
    const out = {};
    for (const key of APPLY.DRAFT_FIELDS) out[key] = val(APPLY.FIELDS[key].id);
    return out;
  };

  /* ----- guide (ephemeral, never persisted) ----- */
  const guide = () => ({
    entityClass: document.querySelector('input[name="g-entity"]:checked')?.value || '',
    market: $('g-market').value,
    role: document.querySelector('input[name="g-role"]:checked')?.value || '',
  });
  function resetGuide() {
    for (const r of document.querySelectorAll('input[name="g-entity"],input[name="g-role"]')) r.checked = false;
    $('g-market').value = '';
    renderGuide();
  }
  function fillList(node, items) {
    node.replaceChildren(...items.map(t => { const li = document.createElement('li'); setTxt(li, t); return li; }));
  }
  function fillLinks(node, keys) {
    node.replaceChildren(...keys.map(k => libLink(APPLY.LIB[k])));
  }
  function renderGuide() {
    const res = decidePath(guide());
    const box = $('guide-result');
    box.replaceChildren();
    if (!res.route) {
      const p = document.createElement('p');
      p.className = 'result-body';
      setTxt(p, GUIDE_COPY.empty);
      box.append(p);
      announce($('guide-live'), '');
      return;
    }
    const roleMod = res.role === 'Bank' ? GUIDE_COPY.roleMod.bank : res.role === 'Other' ? GUIDE_COPY.roleMod.other : GUIDE_COPY.roleMod.activity;
    const marketMod = res.market === 'Other' ? GUIDE_COPY.marketOther : GUIDE_COPY.marketMod(res.market);
    const parts = [
      ['p', 'result-label', GUIDE_COPY.label],
      ['p', 'result-title', GUIDE_COPY.titles[res.route]],
      ['p', 'result-body', GUIDE_COPY.bodies[res.route]],
    ];
    if (res.entity === 'sponsored' && res.role === 'Bank') parts.push(['p', 'result-note', GUIDE_COPY.bankNote]);
    for (const [tag, cls, text] of parts) { const n = document.createElement(tag); n.className = cls; setTxt(n, text); box.append(n); }
    const boundary = document.createElement('p');
    boundary.className = 'boundary';
    setTxt(boundary, GUIDE_COPY.boundary);
    box.append(boundary);

    const h = document.createElement('p');
    h.className = 'ev-h';
    setTxt(h, GUIDE_COPY.evHeading);
    const lead = document.createElement('p');
    lead.className = 'ev-lead';
    setTxt(lead, GUIDE_COPY.evLead);
    const ul = document.createElement('ul');
    ul.className = 'ev-list';
    fillList(ul, GUIDE_COPY.lists[res.route]);
    const roleP = document.createElement('p');
    roleP.className = 'result-note';
    setTxt(roleP, roleMod);
    const marketP = document.createElement('p');
    marketP.className = 'result-note';
    setTxt(marketP, marketMod);
    const foot = document.createElement('p');
    foot.className = 'ev-footer';
    setTxt(foot, GUIDE_COPY.evFooter);
    const links = document.createElement('div');
    links.className = 'guide-links';
    fillLinks(links, ['criteria', 'markets', 'roadmap']);
    box.append(h, lead, ul, roleP, marketP, foot, links);
    announce($('guide-live'), `${GUIDE_COPY.label} ${GUIDE_COPY.titles[res.route]}`);
  }
  for (const input of document.querySelectorAll('input[name="g-entity"],input[name="g-role"]')) input.addEventListener('change', renderGuide);
  $('g-market').addEventListener('change', renderGuide);
  $('side-details').addEventListener('toggle', () => { S.sideOpen = $('side-details').open; });

  /* ----- markets ----- */
  async function loadMarkets() {
    S.marketState = 'loading';
    $('market-fallback').hidden = true;
    try {
      const rows = await fetchMarkets();
      const sorted = [...rows].sort((a, b) => (b.live - a.live) || String(a.name).localeCompare(String(b.name)));
      S.markets = sorted.filter(m => m && m.code);
      S.marketState = 'ready';
      S.staleMarket = false;
    } catch {
      S.marketState = 'error';
    }
    renderMarkets();
    if (S.step === 5) renderReview();
  }
  function renderMarkets() {
    const sel = $('f-country');
    const keep = sel.value;
    const opts = [`<option value="">Choose a market</option>`];
    for (const m of S.markets) opts.push(`<option value="${m.code}">${String(m.name).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</option>`);
    opts.push(`<option value="__other">Other</option>`);
    if (keep && keep !== '__other' && !S.markets.some(m => m.code === keep)) opts.push(`<option value="${keep}">${keep}</option>`);
    sel.innerHTML = opts.join('');
    sel.value = keep;
    $('market-fallback').hidden = S.marketState !== 'error';
  }

  /* ----- error summary + inline errors ----- */
  function clearErrors() {
    for (const f of Object.values(APPLY.FIELDS)) {
      const n = $(f.id);
      if (!n) continue;
      n.removeAttribute('aria-invalid');
      n.classList.remove('invalid');
    }
    $('err-summary').hidden = true;
    $('err-list').replaceChildren();
  }
  function showErrors(list, { submit = false } = {}) {
    clearErrors();
    $('err-summary-t').textContent = submit
      ? 'Check the highlighted fields before submitting.'
      : 'Check the highlighted fields before continuing.';
    const ul = $('err-list');
    for (const { key, message } of list) {
      const id = APPLY.FIELDS[key]?.id || key;
      const step = APPLY.FIELDS[key]?.step;
      const n = $(id);
      if (n) { n.setAttribute('aria-invalid', 'true'); n.classList.add('invalid'); }
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${id}`;
      a.addEventListener('click', ev => {
        ev.preventDefault();
        if (step && step !== S.step) goto(step, { focus: false });
        $(id).focus();
      });
      setTxt(a, message);
      li.append(a);
      ul.append(li);
    }
    $('err-summary').hidden = false;
    $('err-summary').focus();
  }
  function fieldErrors(keys) {
    const all = validateValues({ ...fields(), country_code: marketState().country_code, market_other: marketState().market_other }, { staleMarket: S.staleMarket });
    return all.filter(e => keys.includes(e.key));
  }
  function marketState() {
    const sel = val('f-country');
    return { country_code: sel, market_other: val('f-market-other') };
  }
  function bindBlur() {
    for (const [key, f] of Object.entries(APPLY.FIELDS)) {
      const n = $(f.id);
      if (!n) continue;
      n.addEventListener('blur', () => {
        if (S.readOnly) return;
        if (!n.dataset.touched) return;
        const bad = fieldErrors([key]);
        if (bad.length) { n.setAttribute('aria-invalid', 'true'); n.classList.add('invalid'); }
        else { n.removeAttribute('aria-invalid'); n.classList.remove('invalid'); }
      });
      n.addEventListener('input', () => { n.dataset.touched = '1'; scheduleDraft(); });
      n.addEventListener('change', () => { n.dataset.touched = '1'; scheduleDraft(); });
    }
    $('f-country').addEventListener('change', () => { S.staleMarket = false; renderMarkets(); });
  }

  /* ----- sidebar ----- */
  function renderSide() {
    const s = APPLY.SIDEBAR[S.step];
    $('side-stage').textContent = s.stage;
    $('side-body').textContent = s.body;
    $('side-evidence').textContent = s.evidence;
    fillLinks($('side-links'), s.links);
    $('side-details').open = S.sideOpen;
  }

  /* ----- review ----- */
  const OPTION_LABELS = {
    entity_class: ENTITY_LABELS,
    operating_role: Object.fromEntries(APPLY.ROLES.map(r => [r, r])),
    tpv_band: Object.fromEntries(APPLY.TPV.map(t => [t, t])),
  };
  function dd(dt, text) {
    const d = document.createElement('dt');
    setTxt(d, dt);
    const v = document.createElement('dd');
    setTxt(v, text);
    return [d, v];
  }
  function renderReview() {
    const f = fields();
    const cards = [
      ['Edit company', 1, [
        ['Legal company name', f.company || 'Not provided'],
        ['Self-described entity class', OPTION_LABELS.entity_class[f.entity_class] || 'Not provided'],
        ['Company website', f.website || 'Not provided'],
      ]],
      ['Edit market & permissions', 2, [
        ['Main market', marketLabel(f.country_code, f.market_other)],
        ['Rails operated', f.rails_operated || 'Not provided'],
        ['Regulator', f.regulator || 'Not provided'],
        ['License or registration ID', f.license_id || 'Not provided'],
      ]],
      ['Edit scale & corridors', 3, [
        ['Operating role', OPTION_LABELS.operating_role[f.operating_role] || 'Not provided'],
        ['Monthly TPV band', OPTION_LABELS.tpv_band[f.tpv_band] || 'Not provided'],
        ['Corridors you could contribute', f.corridors_contribute || 'Not provided'],
        ['Corridors you hope to receive', f.corridors_receive || 'Not provided'],
        ['Proposed contribution', f.contribution || 'Not provided'],
      ]],
      ['Edit contact & consent', 4, [
        ['Contact name', f.contact_name || 'Not provided'],
        ['Work email', f.contact_email || 'Not provided'],
        ['Consent', $('f-consent').checked ? 'Confirmed for this submission' : 'Confirmation required'],
      ]],
    ];
    const host = $('review-cards');
    host.replaceChildren();
    for (const [label, stepNo, rows] of cards) {
      const card = document.createElement('div');
      card.className = 'rev-card';
      const h = document.createElement('h3');
      const t = document.createElement('span');
      setTxt(t, APPLY.STEP_NAMES[stepNo - 1]);
      const b = document.createElement('button');
      b.type = 'button';
      setTxt(b, label);
      b.addEventListener('click', () => { S.reviewReturn = true; goto(stepNo); });
      h.append(t, b);
      const dl = document.createElement('dl');
      for (const [dt, text] of rows) dl.append(...dd(dt, text));
      card.append(h, dl);
      host.append(card);
    }
  }
  function marketLabel(code, other) {
    if (code === '__other') return other || 'Not provided';
    if (code) return S.markets.find(m => m.code === code)?.name || code;
    return other || 'Not provided';
  }

  /* ----- navigation ----- */
  function stepRoot(n) { return $(`step-${n}`); }
  function setDisabled(n, off) {
    const root = stepRoot(n);
    if (!root) return;
    root.hidden = off;
    for (const c of root.querySelectorAll('input,select,textarea,button')) c.disabled = off;
  }
  function renderProgress() {
    for (const li of $('progress').querySelectorAll('li')) {
      const n = Number(li.dataset.step);
      const isCur = n === S.step;
      const isDone = n < S.step;
      li.classList.toggle('cur', isCur);
      li.classList.toggle('done', isDone);
      if (isCur) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
      const holder = li.querySelector('span[data-slot]');
      holder.replaceChildren();
      if (isDone) {
        const b = document.createElement('button');
        b.type = 'button';
        setTxt(b, APPLY.STEP_NAMES[n - 1]);
        b.setAttribute('aria-label', `Return to ${APPLY.STEP_NAMES[n - 1]}`);
        b.addEventListener('click', () => goto(n));
        holder.append(b);
      } else setTxt(holder, APPLY.STEP_NAMES[n - 1]);
    }
  }
  function goto(n, { focus = true } = {}) {
    if (S.step !== n) setDisabled(S.step, true);
    S.step = n;
    S.readOnly = false;
    for (let i = 1; i <= 5; i++) setDisabled(i, i !== n);
    $('entry').hidden = true;
    form.hidden = false;
    $('step-tag').textContent = `Step ${n} of 5`;
    $('btn-back').textContent = n === 1 ? 'Back to introduction' : 'Back';
    $('btn-next').textContent = S.reviewReturn && n < 5 ? 'Save changes and return to review' : n === 4 ? 'Review application' : 'Continue';
    $('btn-next').hidden = n === 5;
    $('submit-row').hidden = n !== 5;
    clearErrors();
    renderProgress();
    renderSide();
    renderConditional();
    renderVerify();
    if (n === 5) { renderReview(); $('review-notice').hidden = !!readAttempt(); }
    if (n === 2 && S.marketState === 'idle' && configured) loadMarkets();
    if (focus) $(`sh-${n}`).focus();
    if (S.reviewReturn && n === 5) S.reviewReturn = false;
  }
  function showEntry(focus = true) {
    form.hidden = true;
    $('entry').hidden = false;
    for (let i = 1; i <= 5; i++) setDisabled(i, true);
    resetGuide();
    const rec = readDraft();
    if (rec) showResumeCard(rec); // a valid draft always offers resume/discard on entry
    else $('draft-card').hidden = true;
    if (focus) $('btn-start').focus();
  }
  $('btn-back').addEventListener('click', () => {
    if (S.step === 1) showEntry();
    else goto(S.step - 1);
  });
  $('btn-next').addEventListener('click', () => {
    const errs = fieldErrors(stepFieldKeys(S.step));
    // C-003b: submission is authenticated — Contact cannot pass on unverified email
    if (S.step === 4 && !S.session && EMAIL_RE.test($('f-email').value.trim())) {
      errs.push({ key: 'contact_email', message: 'Verify your email to submit — send yourself a secure sign-in link first.' });
    }
    if (errs.length) { showErrors(errs); return; }
    const returning = S.reviewReturn;
    if (returning) S.reviewReturn = false;
    goto(returning ? 5 : S.step + 1);
    saveNow({ announce: true });
  });
  function stepFieldKeys(n) { return Object.keys(APPLY.FIELDS).filter(k => APPLY.FIELDS[k].step === n); }

  /* ----- drafts ----- */
  function blocked() { return S.conflict || S.submitted || S.submitting || S.uncertain; }
  function scheduleDraft() {
    if (!S.optIn || blocked()) return;
    const myGen = ++S.gen;
    clearTimeout(S.timer);
    S.timer = setTimeout(() => { if (myGen === S.gen) flushDraft(); }, APPLY.DEBOUNCE_MS);
  }
  function flushDraft() {
    if (!S.optIn || blocked()) return;
    const res = writeDraft(fields(), S.step);
    S.draftOk = res.ok;
    if (!res.ok) announceDraftFail();
    else S.savedAt = res.at;
  }
  function saveNow({ announce: say = false } = {}) {
    clearTimeout(S.timer);
    S.gen++;
    if (!S.optIn || blocked()) return;
    const res = writeDraft(fields(), S.step);
    S.draftOk = res.ok;
    if (!res.ok) { announceDraftFail(); return; }
    S.savedAt = res.at;
    const savedMsg = `Draft saved in this browser. Last saved ${stamp(S.savedAt)}.`;
    if (say) {
      $('draft-status').textContent = savedMsg;
      announce($('state-live'), savedMsg);
    }
  }
  function announceDraftFail() {
    announce($('state-live'), 'This browser could not save your draft. You can continue, but keep this page open or your answers may be lost.');
    $('draft-status').textContent = 'This browser could not save your draft. You can continue, but keep this page open or your answers may be lost.';
  }
  const stamp = ts => new Date(ts).toLocaleString('en', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  function applyDraft(rec) {
    for (const key of APPLY.DRAFT_FIELDS) {
      const n = $(APPLY.FIELDS[key].id);
      if (n) n.value = rec.fields[key] ?? '';
    }
    if (S.session) { // the verified session owns the address, draft or not
      const n = $('f-email');
      n.value = S.session;
      n.disabled = true;
    }
    $('f-consent').checked = false; // consent is never restored
    S.staleMarket = false;
    const code = rec.fields.country_code;
    if (code && code !== '__other' && S.marketState === 'ready' && !S.markets.some(m => m.code === code)) S.staleMarket = true;
    renderMarkets(); // keeps a saved-but-stale code visible until the user reselects
    renderConditional();
  }
  $('f-draft').addEventListener('change', async e => {
    const on = e.target.checked;
    clearTimeout(S.timer);
    S.gen++;
    S.optIn = on;
    if (on) {
      const res = writeDraft(fields(), S.step);
      S.draftOk = res.ok;
      if (!res.ok) { announceDraftFail(); return; }
      S.savedAt = res.at;
      const savedMsg = `Draft saved in this browser. Last saved ${stamp(S.savedAt)}.`;
      $('draft-status').textContent = savedMsg;
      announce($('state-live'), savedMsg);
      return;
    }
    const removed = draftPurgeRaw();
    if (removed) {
      S.savedAt = null;
      announce($('state-live'), 'Browser draft deleted. Your current answers remain on this page.');
      $('draft-status').textContent = '';
    } else {
      S.draftOk = false;
      $('draft-status').textContent = 'This browser could not delete the saved draft. Clear this site\'s browser data to remove it.';
    }
  });
  window.addEventListener('pagehide', () => { if (S.optIn && !blocked()) writeDraft(fields(), S.step); });
  window.addEventListener('storage', e => {
    if (e.key !== APPLY.DRAFT_KEY) return;
    S.conflict = true;
    clearTimeout(S.timer);
    S.gen++;
    $('conflict-card').hidden = false;
    announce($('state-live'), 'This browser draft changed in another tab. Your current answers have not been replaced.');
  });
  $('btn-keep-answers').addEventListener('click', () => {
    S.conflict = false;
    $('conflict-card').hidden = true;
    S.optIn = true;
    $('f-draft').checked = true;
    saveNow({ announce: true });
  });
  $('btn-load-saved').addEventListener('click', () => {
    const rec = readDraft();
    if (!rec) { $('conflict-card').hidden = true; S.conflict = false; return; }
    applyDraft(rec);
    S.conflict = false;
    $('conflict-card').hidden = true;
    announce($('state-live'), 'Saved draft loaded.');
  });

  /* ----- entry: resume / discard ----- */
  function showResumeCard(rec) {
    $('draft-card').hidden = false;
    $('draft-msg').textContent = `A draft is available in this browser. Last saved ${stamp(rec.updatedAt)}. It has not been submitted.`;
  }
  $('btn-resume').addEventListener('click', async () => {
    const rec = readDraft();
    if (!rec) { $('draft-card').hidden = true; return; }
    await ensureMarkets();
    applyDraft(rec);
    resetGuide();
    $('draft-card').hidden = true;
    $('restored-note').hidden = false;
    goto(Math.min(Math.max(rec.step, 1), 4));
    announce($('state-live'), 'Your draft is restored. Review your answers and confirm consent before submitting.');
  });
  $('btn-discard').addEventListener('click', () => { S.pendingStart = false; $('discard-confirm').hidden = false; });
  $('btn-keep-draft').addEventListener('click', () => { $('discard-confirm').hidden = true; });
  $('btn-delete-draft').addEventListener('click', async () => {
    clearTimeout(S.timer);
    S.gen++;
    $('discard-confirm').hidden = true;
    if (!draftPurgeRaw()) {
      $('draft-status').textContent = 'This browser could not delete the saved draft. Clear this site\'s browser data to remove it.';
      return;
    }
    $('draft-card').hidden = true;
    $('draft-status').textContent = '';
    announce($('state-live'), 'Draft deleted.');
    if (S.pendingStart) { S.pendingStart = false; await ensureMarkets(); goto(1); }
    else showEntry();
  });
  async function ensureMarkets() {
    if (S.marketState === 'idle' && configured) await loadMarkets();
  }
  $('btn-start').addEventListener('click', async () => {
    resetGuide();
    if (readDraft()) { // never silently overwrite a saved draft
      S.pendingStart = true;
      $('discard-confirm').hidden = false;
      return;
    }
    $('draft-card').hidden = true;
    await ensureMarkets();
    goto(1);
  });
  $('btn-market-retry').addEventListener('click', loadMarkets);

  /* ----- conditional copy driven by the application entity class ----- */
  const CONDITIONAL = {
    founding: {
      notice: 'Review considers your permissions, existing activity and proposed corridor contribution.',
      contribution: 'Explain the current licensed activity and distribution you could contribute.',
    },
    institutional: {
      notice: 'Review considers your permissions, institutional capabilities and proposed operating role.',
      contribution: 'Explain the institutional capabilities and operating responsibilities you could contribute.',
    },
    sponsored: {
      notice: 'Sponsored participation operates under a licensed member\'s seat, without a seat of your own. The relationship and activity remain subject to review.',
      contribution: 'Explain your distribution and any licensed-member relationship, distinguishing confirmed arrangements from discussions.',
    },
  };
  function renderConditional() {
    const c = CONDITIONAL[val('f-entity')] || null;
    $('entity-notice').textContent = c ? c.notice : '';
    $('entity-notice').hidden = !c;
    const sponsored = val('f-entity') === 'sponsored';
    $('label-regulator').textContent = sponsored ? 'Regulator, if applicable (optional)' : 'Regulator (optional)';
    $('label-license').textContent = sponsored ? 'License or registration ID, if applicable (optional)' : 'License or registration ID (optional)';
    const permHelper = sponsored
      ? 'Enter only a reference belonging to the applying entity. Do not enter a sponsor\'s license as your own.'
      : null;
    $('hint-regulator').textContent = permHelper || 'Name the authority relevant to this entity and activity.';
    $('hint-license').textContent = permHelper || 'Provide the reference you can evidence. A registration is not automatically an authorization.';
    $('perm-note').hidden = !sponsored;
    $('perm-note').textContent = 'Describe any licensed-member relationship in your contribution summary. Do not include confidential agreements.';
    if (c) $('hint-contribution').textContent = c.contribution;
    const other = val('f-country') === '__other';
    $('market-other-field').hidden = !other;
    $('f-market-other').disabled = !other;
  }
  $('f-entity').addEventListener('change', renderConditional);
  $('f-country').addEventListener('change', renderConditional);

  /* ----- contact step: email verification gates submission (C-003b) ----- */
  // ponytail: same-tab snapshot so the sign-in-link round-trip does not lose
  // answers; sessionStorage dies with the tab, the local draft stays opt-in
  const VERIFY_SNAP_KEY = 'soberana.apply.v2.authctx';
  function verifySnap(recover) {
    try {
      if (recover === null) return JSON.parse(sessionStorage.getItem(VERIFY_SNAP_KEY) || 'null');
      sessionStorage.removeItem(VERIFY_SNAP_KEY);
    } catch { return null; }
    return null;
  }
  async function lockEmailToSession() {
    if (!getSessionEmail) return;
    S.session = await getSessionEmail();
    if (!S.session) return;
    const n = $('f-email');
    n.value = S.session;
    n.disabled = true;
    $('btn-send-link').hidden = true;
  }
  function renderVerify() {
    if (!S.session) return; // unverified: the send-link button stays available
    const n = $('f-email');
    if (n.value !== S.session) n.value = S.session;
    n.disabled = true;
    $('btn-send-link').hidden = true;
  }
  $('btn-send-link').addEventListener('click', async () => {
    const email = $('f-email').value.trim();
    if (!EMAIL_RE.test(email)) { showErrors([{ key: 'contact_email', message: APPLY.FIELDS.contact_email.error }]); return; }
    try { sessionStorage.setItem(VERIFY_SNAP_KEY, JSON.stringify({ fields: fields() })); } catch { /* continue in memory */ }
    $('btn-send-link').disabled = true;
    try {
      await sendSignInLink(email, window.location.href);
    } catch {
      const st = $('verify-status');
      st.textContent = 'We could not send the link. Check the address and try again.';
      st.hidden = false;
      $('btn-send-link').disabled = false;
      return;
    }
    $('btn-send-link').disabled = false;
    const st = $('verify-status');
    st.textContent = `We sent you a secure sign-in link to ${email}. Open it in this browser to verify the address and continue here.`;
    st.hidden = false;
    announce($('state-live'), 'We sent you a secure sign-in link. Open it in this browser, then return here to submit.');
  });
  async function restoreAfterVerification() {
    const snap = verifySnap(null);
    verifySnap(); // one-time use either way
    await ensureMarkets();
    await lockEmailToSession();
    if (snap && snap.fields) applyDraft({ fields: snap.fields });
    goto(4);
    const st = $('verify-status');
    st.textContent = 'Your email is verified. Review your answers and submit — the application is sent under this address.';
    st.hidden = false;
    announce($('state-live'), st.textContent);
  }


  /* ----- submission ----- */
  let slowTimer = 0;
  function readAttempt() {
    try { return JSON.parse(sessionStorage.getItem(APPLY.ATTEMPT_KEY) || 'null'); } catch { return null; }
  }
  function writeAttempt(state) {
    try {
      sessionStorage.setItem(APPLY.ATTEMPT_KEY, JSON.stringify({ state, startedAt: Date.now() }));
      return true;
    } catch { return false; }
  }
  function clearAttempt() {
    try { sessionStorage.removeItem(APPLY.ATTEMPT_KEY); } catch { /* in-memory guard remains */ }
  }
  function renderAttemptState() {
    const a = readAttempt();
    const uncertain = S.uncertain || (a && (a.state === 'pending' || a.state === 'uncertain'));
    $('attempt-card').hidden = !uncertain;
    $('review-notice').hidden = uncertain;
    if (!uncertain) return;
    S.uncertain = true;
    S.readOnly = true;
    setReadonly(true);
    $('attempt-msg').textContent = 'We could not confirm whether your application was received. Do not submit again yet. Check your status using the email entered in this application.';
    $('retry-warning').hidden = true;
    if ($('attempt-card').hidden === false) $('review-notice').hidden = true;
  }
  function setReadonly(on) {
    for (const c of form.querySelectorAll('input,select,textarea')) c.disabled = on;
    if (S.session) $('f-email').disabled = true; // stays locked to the verified session
    $('submit-btn').disabled = on;
    for (const b of $('review-cards').querySelectorAll('button')) b.disabled = on;
  }
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (S.step !== 5 || S.submitting || S.readOnly || S.uncertain || S.submitted) return;
    const errs = validateValues({ ...fields(), country_code: marketState().country_code, market_other: marketState().market_other }, { staleMarket: S.staleMarket });
    if (!$('f-consent').checked) errs.push({ key: 'f-consent', message: 'Confirm consent before submitting.' });
    if (errs.length) { showErrors(errs, { submit: true }); return; }
    S.submitting = true;
    S.uncertain = false;
    $('submit-err').hidden = true;
    writeAttempt('pending');
    const storageOk = readAttempt()?.state === 'pending';
    if (!storageOk) $('nosession-note').hidden = false;
    const btn = $('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Submitting…';
    $('step-5').setAttribute('aria-busy', 'true');
    announce($('state-live'), 'Submitting…');
    clearTimeout(slowTimer);
    slowTimer = setTimeout(() => { $('slow-note').hidden = false; }, 30000);
    const payload = buildPayload({ ...fields(), country_code: marketState().country_code, market_other: marketState().market_other, consent: $('f-consent').checked, company_web: val('f-company_web') });
    if (S.session) payload.contact_email = S.session; // rules bind the application to the session email
    try {
      const res = await submitApplication(payload);
      clearTimeout(slowTimer);
      $('slow-note').hidden = true;
      if (res && res.ok && res.ref && isValidRef(res.ref) && res.id) {
        S.submitted = true;
        S.submitting = false;
        clearAttempt();
        const draftGone = draftPurgeRaw();
        const marker = { ref: res.ref, receivedAt: Date.now() };
        if (!draftGone) marker.cleanupWarning = true;
        let stored = true;
        try { sessionStorage.setItem(APPLY.RECEIPT_KEY, JSON.stringify(marker)); } catch { stored = false; }
        S.lastResult = { ...marker };
        if (!stored) { renderInlineReceipt(marker); return; }
        window.location.href = `submitted.html?ref=${encodeURIComponent(res.ref)}`;
        return;
      }
      if (res && res.ok) { // {ok:true, ref:null} honeypot branch or malformed success — never a receipt
        S.uncertain = true;
        renderUncertain();
        return;
      }
      clearAttempt();
      S.submitting = false;
      btn.disabled = false;
      btn.textContent = 'Submit application';
      $('step-5').removeAttribute('aria-busy');
      const msg = res?.error === 'rate_limited'
        ? 'The submission limit for this email has been reached. Check your application status before trying again later.'
        : res?.error === 'invalid'
          ? 'We could not accept these details. Review the required fields and consent, then try again.'
          : null;
      if (msg) { $('submit-err').textContent = msg; $('submit-err').hidden = false; $('submit-err').focus(); }
      else renderUncertain();
    } catch {
      clearTimeout(slowTimer);
      $('slow-note').hidden = true;
      S.submitting = false;
      renderUncertain();
    }
  });
  function renderUncertain() {
    S.uncertain = true;
    S.readOnly = true;
    S.submitting = false;
    setReadonly(true);
    writeAttempt('uncertain');
    $('attempt-card').hidden = false;
    $('review-notice').hidden = true; // the attempt warning replaces the generic notice
    $('attempt-msg').textContent = 'We could not confirm whether your application was received. Do not submit again yet. Check your status using the email entered in this application.';
    $('submit-btn').disabled = true;
    $('submit-btn').textContent = 'Submit application';
    $('step-5').removeAttribute('aria-busy');
    announce($('state-live'), $('attempt-msg').textContent);
  }
  $('btn-status-uncertain').addEventListener('click', () => { window.location.href = 'status.html'; });
  $('btn-return-review').addEventListener('click', () => { $('retry-warning').hidden = false; });
  $('btn-retry-yes').addEventListener('click', () => {
    clearAttempt();
    S.uncertain = false;
    S.readOnly = false;
    $('attempt-card').hidden = true;
    $('retry-warning').hidden = true;
    setReadonly(false);
    renderReview();
    writeAttempt('pending');
    announce($('state-live'), 'A second submission may create a duplicate if the first request completed. Status may take time to update.');
  });
  function renderInlineReceipt(marker) {
    form.hidden = true;
    $('inline-receipt').hidden = false;
    $('inline-ref').textContent = marker.ref;
  }

  /* ----- attempt marker restoration + BFCache ----- */
  window.addEventListener('pageshow', () => {
    // BFCache restoration: guide answers are never retained
    resetGuide();
    const a = readAttempt();
    if (a && (a.state === 'pending' || a.state === 'uncertain')) renderAttemptState();
    if (!sessionStorageAvailable()) $('nosession-note').hidden = false;
  });
  function sessionStorageAvailable() {
    try { sessionStorage.setItem('__probe', '1'); sessionStorage.removeItem('__probe'); return true; } catch { return false; }
  }

  /* ----- boot ----- */
  form.hidden = true;
  for (let i = 1; i <= 5; i++) setDisabled(i, true);
  bindBlur();
  renderGuide();
  renderProgress();
  const existing = readDraft();
  if (existing) showResumeCard(existing);
  if (!configured) $('submit-btn').disabled = true; // not wired to a backend yet
  if (!sessionStorageAvailable()) $('nosession-note').hidden = false;
  const attempt = readAttempt();
  if (attempt && (attempt.state === 'pending' || attempt.state === 'uncertain')) {
    if (configured) loadMarkets();
    lockEmailToSession();
    goto(5, { focus: false });
    renderAttemptState();
  } else if (verifiedReturn) {
    restoreAfterVerification();
  } else {
    lockEmailToSession(); // a persisted session locks the contact email on later steps
    showEntry(false);
  }
}

/* ---------- submitted.html: same-tab validated receipt ---------- */
/** Both the sessionStorage marker and the query ref must be valid and matching. */
export function readReceipt(queryRef, now = Date.now()) {
  const linkRef = typeof queryRef === 'string' && isValidRef(queryRef) ? queryRef : null;
  const fail = () => ({ ok: false, linkRef });
  let raw = null;
  try { raw = sessionStorage.getItem(APPLY.RECEIPT_KEY); } catch { raw = null; }
  if (!raw) return fail();
  let m;
  try { m = JSON.parse(raw); } catch { return fail(); }
  if (!m || typeof m !== 'object') return fail();
  const { ref, receivedAt, cleanupWarning } = m;
  if (!isValidRef(ref)) return fail();
  if (!Number.isFinite(receivedAt) || receivedAt > now || now - receivedAt > APPLY.RECEIPT_TTL_MS) return fail();
  if (queryRef !== ref) return fail();
  return { ok: true, ref, receivedAt, cleanupWarning: cleanupWarning === true };
}

