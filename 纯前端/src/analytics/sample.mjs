import { MINUTE_SECONDS, SECOND_MS, summarizeMatrix } from './aggregate.mjs';

const HOUR_MS = 3600 * SECOND_MS;
const MINUTE_MS = MINUTE_SECONDS * SECOND_MS;
export const SAMPLE_START_MS = Date.parse('2026-11-21T08:00:00+08:00');
// Five complete cycles per minute, with a mean multiplier of 1.
const SECOND_PERCENT = [82, 88, 92, 98, 105, 113, 124, 115, 107, 99, 92, 85];

function directions(links, medium) {
  return links.flatMap(({ a, b }) => [
    { src: a, dst: b, medium },
    { src: b, dst: a, medium },
  ]);
}

function baseRate(record, sectionIndex, minute, hotspot) {
  const { src, dst, medium } = record;
  const optical = medium === 'optical';
  const seed = src * 37 + dst * 19 + sectionIndex * 11 + (optical ? 7 : 0);
  const hot = optical && src === hotspot.src && dst === hotspot.dst;
  if (!hot && seed % 7 === 0) return 0;
  const ordinary = optical ? 12 + seed % 17 : 9 + seed % 20;
  const rate = hot ? [118, 148, 106][sectionIndex] : ordinary;
  const variation = 81 + (seed * 5 + minute * 7) % 40;
  const edge = minute < 5 || minute >= 55;
  return Math.round(rate * variation / 100 * (edge ? (hot ? 3 : 1.35) : 1));
}

export function createHistorySample(config) {
  const rackIds = config.tors.map(tor => tor.id);
  const electrical = directions(config.electricLinks, 'electric');
  const idleDirection = electrical.at(-1);
  const minuteBuckets = [];
  const matrixRecords = [];
  const sections = config.strategies.slice(0, 3).map(({ id, pairs }, sectionIndex) => {
    const startMs = SAMPLE_START_MS + sectionIndex * HOUR_MS;
    const candidates = directions(pairs, 'optical');
    const hotspot = candidates[sectionIndex % 2];
    for (let minute = 0; minute < 60; minute += 1) {
      const timeMs = startMs + minute * MINUTE_MS;
      const records = [...electrical, ...candidates].map(record => {
        const idle = record.src === idleDirection.src && record.dst === idleDirection.dst;
        const base = idle ? 0 : baseRate(record, sectionIndex, minute, hotspot);
        return { ...record, base };
      });
      minuteBuckets.push({ timeMs, strategyId: id, records });
      for (const { src, dst, medium, base } of records) {
        matrixRecords.push({ timeMs, src, dst, medium, gbit: base * MINUTE_SECONDS });
      }
    }
    return { strategyId: id, startMs, endMs: startMs + HOUR_MS };
  });

  const firstMs = sections[2].startMs - 30 * SECOND_MS;
  const samples = Array.from({ length: 120 }, (_, index) => {
    const timeMs = firstMs + index * SECOND_MS;
    const minute = minuteBuckets[Math.floor((timeMs - SAMPLE_START_MS) / MINUTE_MS)];
    const second = (timeMs - minute.timeMs) / SECOND_MS;
    const records = minute.records.map(({ base, src, dst, medium }) => {
      const phase = src * 2 + dst + (medium === 'optical' ? 5 : 0);
      const rate = base * SECOND_PERCENT[(second + phase) % SECOND_PERCENT.length] / 100;
      return { src, dst, medium, rate };
    });
    return { timeMs, strategyId: minute.strategyId, records };
  });

  const matrices = sections.map(section => summarizeMatrix(matrixRecords, section, rackIds));
  return {
    tors: config.tors,
    rackIds,
    samples,
    matrices,
    colorMax: Math.max(...matrices.map(matrix => matrix.maxShare)),
  };
}
