import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeMatrix, summarizeMinute } from '../../src/analytics/aggregate.mjs';
import { createHistorySample } from '../../src/analytics/sample.mjs';
import { defaultConfig } from '../../src/sim/config.mjs';
import cluster8 from '../../src/sim/cluster8.mjs';

const minuteStart = Date.parse('2026-11-21T09:59:30+08:00');
const hourStart = Date.parse('2026-11-21T09:00:00+08:00');
const hour = { strategyId: 'B', startMs: hourStart, endMs: hourStart + 3600_000 };
const ids = [0, 1, 2, 3];
const rate = (src, dst, medium, value) => ({ src, dst, medium, rate: value });
const sample = (second, records = [], strategyId = 'B') => ({
  timeMs: minuteStart + second * 1000, strategyId, records,
});

test('B1 · minute shares integrate traffic volume over unequal throughputs', () => {
  const samples = Array.from({ length: 60 }, (_, index) => index < 30
    ? sample(index, [rate(0, 1, 'optical', 80), rate(0, 1, 'electric', 20)])
    : sample(index, [rate(0, 1, 'optical', 10), rate(0, 1, 'electric', 40)], 'C'));
  const summary = summarizeMinute(samples, ids);
  assert.deepEqual(summary.totals, { optical: 2700, electric: 1800 });
  assert.deepEqual(summary.shares, { optical: 0.6, electric: 0.4 });
  assert.deepEqual(summary.segments.map(({ strategyId, seconds, shares }) => ({ strategyId, seconds, shares })), [
    { strategyId: 'B', seconds: 30, shares: { optical: 0.8, electric: 0.2 } },
    { strategyId: 'C', seconds: 30, shares: { optical: 0.2, electric: 0.8 } },
  ]);
  assert.equal(summary.segments[0].endMs, summary.segments[1].startMs);
  assert.equal(summary.segments[1].startMs, minuteStart + 30_000);
  assert.equal(summary.endMs - summary.startMs, 60_000);
  assert.deepEqual(summarizeMinute([sample(0), sample(1, [], 'C'), sample(2)], ids).segments.map(s => s.strategyId), ['B', 'C', 'B']);
  console.log('B1 minute:', summary.totals, summary.shares, summary.segments.map(segment => segment.shares));
});

test('B1 · ToR uses only the last sample and credits each direction once', () => {
  const earlier = sample(0, [rate(2, 3, 'electric', 999)]);
  const final = sample(1, [rate(0, 1, 'optical', 8), rate(0, 1, 'electric', 2), rate(1, 0, 'electric', 4)]);
  const summary = summarizeMinute([earlier, final], ids);
  const point = summary.points.at(-1);
  assert.deepEqual(point, { timeMs: final.timeMs, optical: 8, electric: 6 });
  assert.deepEqual(summary.rackRates.map(({ id, sent, received }) => ({ id, sent, received })), [
    { id: 0, sent: 10, received: 4 }, { id: 1, sent: 4, received: 10 },
    { id: 2, sent: 0, received: 0 }, { id: 3, sent: 0, received: 0 },
  ]);
  assert.deepEqual(summary.rackRates.map(rack => [
    rack.sentByMedium.optical, rack.sentByMedium.electric,
    rack.receivedByMedium.optical, rack.receivedByMedium.electric,
  ]), [[8, 2, 0, 4], [0, 4, 8, 2], [0, 0, 0, 0], [0, 0, 0, 0]]);
  assert.equal(summary.rackRates.reduce((sum, tor) => sum + tor.sent, 0), 14);
  assert.equal(summary.rackRates.reduce((sum, tor) => sum + tor.received, 0), 14);
  console.log('B1 last second:', point, summary.rackRates);
});

test('B1/B3 · matrix includes 09:05, excludes 09:55, and ignores high edge traffic', () => {
  const record = (minute, src, dst, gb, medium = 'electric') =>
    ({ timeMs: hourStart + minute * 60_000, src, dst, medium, gbit: gb * 8 });
  const core = [record(5, 0, 1, 20, 'optical'), record(54, 0, 1, 10), record(30, 1, 0, 10)];
  const edges = [record(0, 0, 1, 900), record(5 - 1 / 60, 1, 0, 900), record(55, 0, 1, 900), record(59, 0, 2, 900)];
  const matrix = summarizeMatrix([...core, ...edges], hour, ids);
  assert.deepEqual(matrix, summarizeMatrix(core, hour, ids));
  assert.equal(matrix.effectiveStartMs, hourStart + 5 * 60_000);
  assert.equal(matrix.effectiveEndMs, hourStart + 55 * 60_000);
  assert.equal(matrix.totalGbit / 8, 40);
  assert.deepEqual(matrix.rows[0].cells[1], { src: 0, dst: 1, gbit: 240, share: 0.75 });
  assert.deepEqual(matrix.rows[1].cells[0], { src: 1, dst: 0, gbit: 80, share: 0.25 });
  assert.equal(matrix.rows[0].cells[0].share, null);
  assert.equal(matrix.rows[0].cells[2].share, 0);
  console.log('B1/B3 cut:', new Date(matrix.effectiveStartMs).toISOString(), new Date(matrix.effectiveEndMs).toISOString(),
    matrix.rows[0].cells[1], matrix.rows[1].cells[0]);
});

test('B1 · empty denominators and a no-switch window', () => {
  const zero = summarizeMinute(Array.from({ length: 60 }, (_, index) => sample(index)), ids);
  assert.equal(zero.shares, null);
  assert.equal(zero.segments.length, 1);
  assert.equal(zero.segments[0].seconds, 60);
  assert.equal(zero.segments[0].shares, null);
  const matrix = summarizeMatrix([], hour, ids);
  assert.equal(matrix.totalGbit, 0);
  assert.ok(matrix.rows.flatMap(row => row.cells).every(cell => cell.share === null && cell.gbit === 0));
});

test('B1/B3 · deterministic 4 and 8 ToR examples with different hotspots and zero cells', () => {
  for (const config of [defaultConfig, cluster8]) {
    const sample = createHistorySample(config);
    assert.deepEqual(sample, createHistorySample(config));
    const { rackIds, matrices, colorMax, samples } = sample;
    assert.equal(samples.length, 120);
    assert.equal(samples[0].timeMs, minuteStart);
    assert.equal(samples[29].strategyId, 'B');
    assert.equal(samples[30].strategyId, 'C');
    assert.equal(colorMax, Math.max(...matrices.map(matrix => matrix.maxShare)));
    const hotspots = new Set();
    for (const matrix of matrices) {
      const cells = matrix.rows.flatMap(row => row.cells);
      assert.equal(cells.length, rackIds.length ** 2);
      assert.ok(cells.some(cell => cell.share === 0));
      assert.ok(Math.abs(cells.reduce((sum, cell) => sum + (cell.share ?? 0), 0) - 1) < 1e-12);
      const hot = cells.find(cell => cell.share === matrix.maxShare);
      const reverse = cells.find(cell => cell.src === hot.dst && cell.dst === hot.src);
      assert.ok(hot.gbit > reverse.gbit);
      hotspots.add(`${hot.src}-${hot.dst}`);
    }
    assert.equal(hotspots.size, 3);
    console.log('sample', rackIds.length, { hotspots: [...hotspots], colorMax });
  }
});
