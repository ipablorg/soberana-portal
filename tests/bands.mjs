/* Band + totals math probe (C-003b §Notas: the §9 totals checks, re-read for the
   client-side computation). Run: node tests/bands.mjs — no dependencies.
   Dimensions fixture = the private seed: D2 w20 · D3 w15 · D5 w20 · D6 w25 · D7 w20. */
import assert from 'node:assert/strict';
import { computeTotals } from '../assets/scoring.js';

const DIMS = [
  { code: 'D2', weight: 20 }, { code: 'D3', weight: 15 }, { code: 'D5', weight: 20 },
  { code: 'D6', weight: 25 }, { code: 'D7', weight: 20 },
];
const FULL_GATES = [
  'D1_license', 'D1_funds_flow', 'D4_sandbox', 'D5_program', 'D6_live_flows',
].map(g => ({ gate_code: g, result: 'pass' }));
const scores = pts => pts.map((p, i) => ({ dimension_code: DIMS[i].code, points: p }));

// C-001 worked examples: 72 → advance, 55 → conditional, 45 → decline
assert.equal(computeTotals({ gates: FULL_GATES, scores: scores([15, 10, 15, 20, 12]), dimensions: DIMS }).band, 'advance');
assert.equal(computeTotals({ gates: FULL_GATES, scores: scores([12, 8, 12, 13, 10]), dimensions: DIMS }).band, 'conditional');
assert.equal(computeTotals({ gates: FULL_GATES, scores: scores([10, 5, 10, 10, 10]), dimensions: DIMS }).band, 'decline');

// boundary values of the band edges
assert.equal(computeTotals({ gates: FULL_GATES, scores: scores([14, 10, 16, 20, 10]), dimensions: DIMS }).band, 'advance'); // exactly 70
assert.equal(computeTotals({ gates: FULL_GATES, scores: scores([12, 8, 10, 10, 10]), dimensions: DIMS }).band, 'conditional'); // exactly 50
assert.equal(computeTotals({ gates: FULL_GATES, scores: scores([12, 8, 10, 10, 9]), dimensions: DIMS }).band, 'decline'); // 49

// blocked states mirror the former v_application_totals: null band, counters kept
let t = computeTotals({ gates: [...FULL_GATES.slice(0, 4), { gate_code: 'D6_live_flows', result: 'fail' }], scores: scores([15, 10, 15, 20, 12]), dimensions: DIMS });
assert.equal(t.band, null);
assert.equal(t.gates_failed, 1);
t = computeTotals({ gates: [...FULL_GATES.slice(0, 4), { gate_code: 'D6_live_flows', result: 'pending' }], scores: scores([15, 10, 15, 20, 12]), dimensions: DIMS }); // a gate still pending
assert.equal(t.band, null);
assert.equal(t.gates_pending, 1);
t = computeTotals({ gates: FULL_GATES, scores: scores([15, 10, 15, 20]), dimensions: DIMS }); // one dimension unscored
assert.equal(t.band, null);
assert.equal(t.dims_scored, 4);

// totals math itself
t = computeTotals({ gates: FULL_GATES, scores: scores([15, 10, 15, 20, 12]), dimensions: DIMS });
assert.equal(t.total_points, 72);
assert.equal(t.max_points, 100);

console.log('bands: all assertions passed (advance/conditional/decline + blocked states + totals)');
