/* Soberana Member Portal — pure scoring math (C-003b: totals/band move from the
   SQL view to the reviewer client; thresholds C-001 §4: ≥70 advance, 50–69
   conditional, <50 decline; open gates or missing dimensions block the band).
   No SDK imports — unit-testable in Node via tests/bands.mjs. */

export function computeTotals({ gates = [], scores = [], dimensions = [] } = {}) {
  const gates_failed = gates.filter(g => g.result === 'fail').length;
  const gates_pending = gates.filter(g => g.result === 'pending').length;
  const dims_scored = scores.length;
  const total_points = scores.reduce((a, s) => a + (Number(s.points) || 0), 0);
  const max_points = dimensions.reduce((a, d) => a + (Number(d.weight) || 0), 0);
  const blocked = gates_failed + gates_pending > 0
    || (dimensions.length > 0 && dims_scored < dimensions.length);
  const band = blocked ? null
    : total_points >= 70 ? 'advance'
    : total_points >= 50 ? 'conditional'
    : 'decline';
  return { gates_failed, gates_pending, dims_scored, total_points, max_points, band };
}
