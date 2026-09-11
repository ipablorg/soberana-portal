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
