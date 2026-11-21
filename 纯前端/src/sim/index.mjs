import { defaultConfig } from './config.mjs';

const PORTS = ['O', 'E1', 'E2', 'E3'];
const STRATEGY_SECONDS = 10;
const ACTIVITY_SECONDS = 3;
const ACTIVE_PROBABILITY = 0.5;
const MAX_RATE = 100;

function validateConfig({ tors, electricLinks, strategies }) {
  if (!tors.length || !strategies.length) throw new Error('ToR and strategy lists must be nonempty');
  const racks = new Map();
  for (const { id, ports } of tors) {
    if (!Number.isSafeInteger(id) || id < 0 || racks.has(id)) throw new Error(`Invalid or duplicate ToR ID: ${id}`);
    if (ports.length !== PORTS.length || PORTS.some(port => !ports.includes(port))) {
      throw new Error(`ToR${id} must have ports O, E1, E2 and E3`);
    }
    racks.set(id, new Set(ports.filter(port => port !== 'O')));
  }

  const edges = new Set();
  for (const { a, b, aPort, bPort } of electricLinks) {
    const edge = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (a === b || edges.has(edge)) throw new Error(`Invalid or duplicate electrical edge: ${edge}`);
    if (!racks.get(a)?.delete(aPort) || !racks.get(b)?.delete(bPort)) {
      throw new Error(`Invalid or reused electrical port on edge ${edge}`);
    }
    edges.add(edge);
  }
  for (const [id, unused] of racks) {
    if (unused.size) throw new Error(`ToR${id} has unused electrical ports`);
  }

  const strategyIds = new Set();
  for (const { id, pairs } of strategies) {
    if (typeof id !== 'string' || !id || strategyIds.has(id)) throw new Error(`Invalid or duplicate strategy ID: ${id}`);
    strategyIds.add(id);
    const unpaired = new Set(racks.keys());
    for (const { a, b } of pairs) {
      if (!unpaired.delete(a) || !unpaired.delete(b)) throw new Error(`Invalid or repeated optical pairing in ${id}`);
    }
    if (unpaired.size) throw new Error(`Strategy ${id} leaves optical ports unpaired`);
  }
}

function directions(medium, links) {
  return links.flatMap(({ a, b }) => [[a, b], [b, a]]).map(([src, dst]) => ({
    id: `${medium}-${src}-${dst}`, medium, src, dst,
  }));
}

function freezeRecords(items) {
  return Object.freeze(items.map(item => Object.freeze({ ...item })));
}

export function createSimulation({ config = defaultConfig, random = Math.random, startMs = Date.now() } = {}) {
  validateConfig(config);

  const tors = freezeRecords(config.tors.map(tor => ({ ...tor, ports: Object.freeze([...tor.ports]) })));
  const electricLinks = freezeRecords(config.electricLinks);
  const electricPaths = directions('electric', electricLinks);
  const strategies = config.strategies.map(({ id, pairs }) => {
    const opticalPairs = freezeRecords(pairs);
    return { id, opticalPairs, paths: [...electricPaths, ...directions('optical', opticalPairs)] };
  });

  let tick = 0;
  let strategyIndex = 0;
  let events = Object.freeze([]);

  function sample(previousFlows = []) {
    const { id: strategyId, opticalPairs, paths } = strategies[strategyIndex];
    const heldActivity = new Map();
    if (tick % ACTIVITY_SECONDS !== 0) {
      for (const flow of previousFlows) heldActivity.set(flow.id, flow.rate > 0);
    }
    const flows = freezeRecords(paths.map(path => {
      // A newly connected optical direction samples immediately, even between activity ticks.
      const active = heldActivity.get(path.id) ?? (random() < ACTIVE_PROBABILITY);
      return { ...path, rate: active ? Math.floor(random() * MAX_RATE) + 1 : 0 };
    }));
    return Object.freeze({ tick, timeMs: startMs + tick * 1000, strategyId, tors, electricLinks, opticalPairs, flows, events });
  }

  let snapshot = sample();
  return {
    current: () => snapshot,
    step() {
      tick += 1;
      if (tick % STRATEGY_SECONDS === 0 && strategies.length > 1) {
        const from = strategies[strategyIndex].id;
        strategyIndex = (strategyIndex + 1) % strategies.length;
        const { id: to, opticalPairs } = strategies[strategyIndex];
        const event = Object.freeze({ tick, timeMs: startMs + tick * 1000, from, to, pairs: freezeRecords(opticalPairs) });
        events = Object.freeze([event, ...events]);
      }
      snapshot = sample(snapshot.flows);
      return snapshot;
    },
  };
}
