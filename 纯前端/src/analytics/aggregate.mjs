export const SECOND_MS = 1000;
export const MINUTE_SECONDS = 60;
export const MATRIX_TRIM_MS = 5 * MINUTE_SECONDS * SECOND_MS;

function mediumTotal() {
  return { optical: 0, electric: 0 };
}

export function mediumShares({ optical, electric }) {
  const total = optical + electric;
  return total > 0 ? { optical: optical / total, electric: electric / total } : null;
}

export function summarizeMinute(samples, rackIds) {
  const totals = mediumTotal();
  const points = [];
  const segments = [];
  const rackRates = new Map(rackIds.map(id => [id, {
    id, sent: 0, received: 0, sentByMedium: mediumTotal(), receivedByMedium: mediumTotal(),
  }]));

  for (const [index, { timeMs, strategyId, records }] of samples.entries()) {
    const point = { timeMs, ...mediumTotal() };
    let segment = segments.at(-1);
    if (segment?.strategyId !== strategyId) {
      segment = { strategyId, startMs: timeMs, seconds: 0, ...mediumTotal() };
      segments.push(segment);
    }
    segment.seconds += 1;
    for (const { src, dst, medium, rate } of records) {
      point[medium] += rate;
      if (index === samples.length - 1) {
        const sender = rackRates.get(src);
        const receiver = rackRates.get(dst);
        sender.sent += rate;
        sender.sentByMedium[medium] += rate;
        receiver.received += rate;
        receiver.receivedByMedium[medium] += rate;
      }
    }
    for (const medium of ['optical', 'electric']) {
      const gbit = point[medium] * (SECOND_MS / 1000);
      segment[medium] += gbit;
      totals[medium] += gbit;
    }
    points.push(point);
  }

  return {
    startMs: points[0].timeMs,
    endMs: points.at(-1).timeMs + SECOND_MS,
    points,
    segments: segments.map(segment => ({
      ...segment,
      endMs: segment.startMs + segment.seconds * SECOND_MS,
      shares: mediumShares(segment),
    })),
    shares: mediumShares(totals),
    totals,
    rackRates: [...rackRates.values()],
  };
}

export function summarizeMatrix(records, section, rackIds, trimMs = MATRIX_TRIM_MS) {
  const effectiveStartMs = section.startMs + trimMs;
  const effectiveEndMs = section.endMs - trimMs;
  const bySource = new Map(rackIds.map(src => [src, new Map(rackIds.map(dst => [dst, 0]))]));
  let totalGbit = 0;
  for (const { timeMs, src, dst, gbit } of records) {
    if (src === dst || timeMs < effectiveStartMs || timeMs >= effectiveEndMs) continue;
    const byTarget = bySource.get(src);
    byTarget.set(dst, byTarget.get(dst) + gbit);
    totalGbit += gbit;
  }

  const rows = rackIds.map(src => ({
    src,
    cells: rackIds.map(dst => {
      const gbit = bySource.get(src).get(dst);
      return { src, dst, gbit, share: src === dst || totalGbit === 0 ? null : gbit / totalGbit };
    }),
  }));
  const maxShare = Math.max(0, ...rows.flatMap(row => row.cells.map(cell => cell.share ?? 0)));
  return { ...section, effectiveStartMs, effectiveEndMs, totalGbit, rows, maxShare };
}
