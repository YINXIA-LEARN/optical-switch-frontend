import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSimulation } from '../../src/sim/index.mjs';
import { defaultConfig } from '../../src/sim/config.mjs';
import cluster8 from '../../src/sim/cluster8.mjs';

const pairKeys = pairs => pairs.map(({ a, b }) => `${a}-${b}`);
const ids = (snapshot, medium) => snapshot.flows.filter(flow => flow.medium === medium).map(flow => flow.id).sort();

function verifyWiring(snapshot, racks) {
  assert.equal(snapshot.tors.length, racks);
  assert.equal(snapshot.electricLinks.length, racks * 3 / 2);
  assert.equal(snapshot.opticalPairs.length, racks / 2);
  assert.equal(new Set(snapshot.flows.map(flow => flow.id)).size, racks * 4);
  assert.equal(ids(snapshot, 'electric').length, racks * 3);
  assert.equal(ids(snapshot, 'optical').length, racks);

  for (const tor of snapshot.tors) {
    assert.deepEqual([...new Set(tor.ports)].sort(), ['E1', 'E2', 'E3', 'O']);
    const endpoints = snapshot.electricLinks.flatMap(({ a, b, aPort, bPort }) => {
      if (a === tor.id) return [[b, aPort]];
      if (b === tor.id) return [[a, bPort]];
      return [];
    }).sort(([left], [right]) => left - right);
    assert.equal(new Set(endpoints.map(([peer]) => peer)).size, 3);
    assert.deepEqual(endpoints.map(([, port]) => port), ['E1', 'E2', 'E3']);
  }
}

function advanceTo(simulation, tick) {
  while (simulation.current().tick < tick) simulation.step();
  return simulation.current();
}

test('M1 · default wiring, all strategies and validation', () => {
  const simulation = createSimulation({ random: () => 0.9 });
  const expectedPairs = new Map([[0, ['0-1', '2-3']], [10, ['0-2', '1-3']], [20, ['0-3', '1-2']]]);
  for (const [tick, pairs] of expectedPairs) {
    const snapshot = advanceTo(simulation, tick);
    verifyWiring(snapshot, 4);
    assert.deepEqual(pairKeys(snapshot.electricLinks), ['0-1', '0-2', '0-3', '1-2', '1-3', '2-3']);
    assert.deepEqual(pairKeys(snapshot.opticalPairs), pairs);
    assert.deepEqual(ids(snapshot, 'optical'), pairs.flatMap(pair => {
      const [a, b] = pair.split('-');
      return [`optical-${a}-${b}`, `optical-${b}-${a}`];
    }).sort());
    console.log('M1', snapshot.strategyId, pairs);
  }
  const badPort = structuredClone(defaultConfig);
  badPort.electricLinks[1].aPort = badPort.electricLinks[0].aPort;
  assert.throws(() => createSimulation({ config: badPort }), /reused electrical port/);
  const badPair = structuredClone(defaultConfig);
  badPair.strategies[0].pairs[1].a = 0;
  assert.throws(() => createSimulation({ config: badPair }), /repeated optical pairing/);
});

test('M2 · independent gates and rates, including zero and endpoints', () => {
  let gates = 0;
  const idle = createSimulation({ random: () => { gates += 1; return 0.5; } }).current();
  assert.equal(gates, 16);
  assert.ok(idle.flows.every(flow => flow.rate === 0));
  const busy = createSimulation({ random: () => 0 }).current();
  assert.ok(busy.flows.every(flow => flow.rate === 1));

  const expected = { 'electric-0-1': 1, 'electric-1-0': 40, 'electric-1-3': 61, 'optical-0-1': 100 };
  const randomValues = idle.flows.flatMap(({ id }) => Object.hasOwn(expected, id)
    ? [0.1, (expected[id] - 0.5) / 100]
    : [0.9]);
  let consumed = 0;
  const mixed = createSimulation({ random: () => randomValues[consumed++] }).current();
  assert.equal(consumed, 20);
  const rates = Object.fromEntries(mixed.flows.map(({ id, rate }) => [id, rate]));
  assert.deepEqual(rates, Object.fromEntries(idle.flows.map(({ id }) => [id, expected[id] ?? 0])));
  console.log('M2', { idleGates: gates, mixedDraws: consumed, rates });
});

test('activity holds for three ticks, rates resample each tick and new optical paths initialize on switch', () => {
  let draw = 0.9;
  const simulation = createSimulation({ random: () => draw });
  const step = (value, electricRate, opticalRate = electricRate) => {
    draw = value;
    const { tick, flows } = simulation.step();
    for (const flow of flows) {
      assert.equal(flow.rate, flow.medium === 'electric' ? electricRate : opticalRate, `tick ${tick}: ${flow.id}`);
    }
  };

  assert.ok(simulation.current().flows.every(flow => flow.rate === 0));
  step(0.1, 0);
  step(0.1, 0);
  step(0.1, 11);
  step(0.99, 100);
  step(0.8, 81);
  for (let tick = 6; tick <= 9; tick++) step(0.9, 0);
  step(0.1, 0, 11); // tick 10: only the newly connected optical directions draw activity.
  step(0.99, 0, 100);
  step(0.9, 0); // tick 12: all directions draw activity again.
});

test('M3 · switch on 10, 20 and 30, immutable history and constant electric directions', () => {
  const startMs = Date.parse('2026-11-21T08:00:00+08:00');
  const simulation = createSimulation({ startMs, random: () => 0.1 });
  const initial = simulation.current();
  assert.equal(initial.events.length, 0);
  const transitions = [['A', 'B', ['0-2', '1-3']], ['B', 'C', ['0-3', '1-2']], ['C', 'A', ['0-1', '2-3']]];
  for (let tick = 1; tick <= 31; tick += 1) {
    const before = simulation.current();
    const current = simulation.step();
    assert.equal(current.tick, tick);
    assert.equal(current.timeMs, startMs + tick * 1000);
    assert.equal(current.events.length, Math.floor(tick / 10));
    assert.strictEqual(current.electricLinks, initial.electricLinks);
    assert.deepEqual(ids(current, 'electric'), ids(initial, 'electric'));
    if (tick % 10 === 0) {
      const [from, to, pairs] = transitions[tick / 10 - 1];
      assert.equal(before.strategyId, from);
      assert.equal(current.strategyId, to);
      const event = current.events[0];
      assert.deepEqual([event.tick, event.timeMs, event.from, event.to], [tick, current.timeMs, from, to]);
      assert.deepEqual(pairKeys(event.pairs), pairs);
      assert.deepEqual(event.pairs, current.opticalPairs);
      assert.notStrictEqual(event.pairs, current.opticalPairs);
      assert.ok(ids(before, 'optical').every(id => !ids(current, 'optical').includes(id)));
      console.log('M3', { tick, from, to, outgoing: ids(before, 'optical'), incoming: ids(current, 'optical') });
    } else {
      assert.equal(current.strategyId, before.strategyId);
      assert.strictEqual(current.events, before.events);
    }
  }
  assert.deepEqual(simulation.current().events.map(event => pairKeys(event.pairs)), transitions.map(entry => entry[2]).reverse());
  assert.equal(initial.tick, 0);
  assert.deepEqual(pairKeys(initial.opticalPairs), ['0-1', '2-3']);
});

test('M4 · eight racks and cross-group optical switching', () => {
  const simulation = createSimulation({ config: cluster8, random: () => 0.35 });
  for (let tick = 0; tick <= 30; tick += 1) {
    const snapshot = advanceTo(simulation, tick);
    verifyWiring(snapshot, 8);
    assert.equal(snapshot.flows.length, 32);
    assert.ok(snapshot.electricLinks.every(({ a, b }) => Math.floor(a / 4) === Math.floor(b / 4)));
    if (tick === 10 || tick === 20) {
      assert.ok(snapshot.opticalPairs.every(({ a, b }) => a < 4 && b >= 4));
      assert.deepEqual(pairKeys(snapshot.opticalPairs), tick === 10
        ? ['0-4', '1-5', '2-6', '3-7']
        : ['0-7', '1-6', '2-5', '3-4']);
      console.log('M4', { tick, rows: snapshot.flows.length, pairs: pairKeys(snapshot.opticalPairs) });
    }
  }
});
