import { render } from 'preact';
import Dashboard from '../../src/ui/Dashboard.jsx';

const timeMs = Date.parse('2026-11-21T17:00:00+08:00');
const tors = [0, 1, 2, 3].map(id => ({ id, label: `ToR${id}`, ports: ['O', 'E1', 'E2', 'E3'] }));
const electricLinks = [
  [0, 'E1', 1, 'E1'], [0, 'E2', 2, 'E1'], [0, 'E3', 3, 'E1'],
  [1, 'E2', 2, 'E2'], [1, 'E3', 3, 'E2'], [2, 'E3', 3, 'E3'],
].map(([a, aPort, b, bPort]) => ({ a, aPort, b, bPort }));
const paired = {
  A: [{ a: 0, b: 1 }, { a: 2, b: 3 }],
  B: [{ a: 0, b: 2 }, { a: 1, b: 3 }],
};
const initialRates = {
  'electric-0-1': 20,
  'electric-0-2': 9,
  'electric-2-0': 20,
  'optical-0-1': 100,
  'optical-2-3': 20,
  'optical-3-2': 9,
};
const switchedRates = {
  'electric-0-1': 20,
  'electric-1-2': 88,
  'electric-2-0': 20,
  'electric-2-3': 9,
  'optical-0-2': 100,
  'optical-2-0': 32,
  'optical-3-1': 42,
};

function flowsFor(medium, links, rates) {
  return links.flatMap(({ a, b }) => [[a, b], [b, a]]).map(([src, dst]) => {
    const id = `${medium}-${src}-${dst}`;
    return { id, medium, src, dst, rate: rates[id] ?? 0 };
  });
}

globalThis.showFixture = (name = 'initial') => {
  const switched = name === 'switched';
  const strategyId = switched ? 'B' : 'A';
  const opticalPairs = paired[strategyId];
  const tick = switched ? 10 : name === 'zero' ? 1 : 0;
  const rates = switched ? switchedRates : name === 'zero' ? {} : initialRates;
  const snapshot = {
    tors, electricLinks, opticalPairs, tick, strategyId, timeMs: timeMs + tick * 1000,
    flows: [...flowsFor('electric', electricLinks, rates), ...flowsFor('optical', opticalPairs, rates)],
    events: switched ? [{ tick, timeMs: timeMs + 10000, from: 'A', to: 'B', pairs: opticalPairs }] : [],
  };
  render(<Dashboard snapshot={snapshot} />, document.querySelector('#app'));
};

showFixture();
