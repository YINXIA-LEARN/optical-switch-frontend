import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const evidence = '.handoff/tasks/T02/evidence/a1';
const host = '127.0.0.1';
const port = 5191;
const url = `http://${host}:${port}/tests/ui/`;
const desktopSize = { width: 1440, height: 900 };
const narrowSize = { width: 390, height: 844 };
await mkdir(evidence, { recursive: true });
const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { host, port, strictPort: true, watch: null },
});
const browser = await chromium.launch({ channel: 'chrome', headless: false });

async function read(page) {
  return page.evaluate(() => {
    const all = selector => [...document.querySelectorAll(selector)];
    const data = (selector, field) => all(selector).map(node => node.dataset[field]);
    return {
      racks: all('[data-tor]').map(node => ({
        id: node.dataset.tor, ports: [...node.querySelectorAll('[data-port]')].map(port => port.dataset.port),
      })),
      electric: all('[data-electric-edge] .electric-base').length,
      drops: all('[data-optical-drop]').length,
      pairs: data('[data-mems] [data-optical-pair]', 'opticalPair'),
      arrows: all('[data-flow]').map(node => [node.dataset.flow, Boolean(node.querySelector('.flow-arrow'))]),
      rates: all('[data-path]').map(node => [node.dataset.path, Number(node.dataset.rate)]),
      ticks: data('[data-view]', 'tick'),
      strategy: document.querySelector('[data-strategy]').dataset.strategy,
      events: all('[data-event-tick]').map(node => ({
        from: node.dataset.from, to: node.dataset.to, tick: node.dataset.eventTick,
        time: node.querySelector('time').dateTime,
        pairs: [...node.querySelectorAll('[data-event-pair]')].map(pair => pair.dataset.eventPair),
      })),
      empty: document.querySelector('.events-empty')?.textContent,
    };
  });
}

try {
  await server.listen();
  console.log(new Date().toISOString(), process.version, `Chrome ${browser.version()}`, url);
  const desktop = await browser.newPage({ viewport: desktopSize, timezoneId: 'Asia/Shanghai' });
  const errors = [];
  desktop.on('pageerror', error => errors.push(error.message));
  await desktop.goto(url);
  await desktop.locator('[data-mems]').waitFor();

  const initial = await read(desktop);
  assert.deepEqual(initial.racks.map(rack => rack.id), ['0', '1', '2', '3']);
  initial.racks.forEach(rack => assert.deepEqual(rack.ports, ['O', 'E1', 'E2', 'E3']));
  assert.equal(initial.electric, 6);
  assert.equal(initial.drops, 4);
  assert.deepEqual(initial.pairs, ['0-1', '2-3']);
  const busy = initial.arrows.filter(([, arrow]) => arrow).map(([id]) => id).sort();
  assert.deepEqual(busy, ['electric-0-1', 'electric-0-2', 'electric-2-0', 'optical-0-1', 'optical-2-3', 'optical-3-2']);
  await desktop.evaluate(() => showFixture('zero'));
  const zero = await read(desktop);
  assert.equal(zero.electric, 6);
  assert.equal(zero.arrows.length, 16);
  assert.ok(zero.arrows.every(([, arrow]) => !arrow));
  assert.ok(zero.rates.every(([, rate]) => rate === 0));
  assert.deepEqual(zero.pairs, initial.pairs);
  console.log('U1 PASS', { busy, idleBases: zero.electric, idlePairs: zero.pairs });

  assert.equal(initial.rates.length, 16);
  assert.deepEqual(initial.rates.slice(0, 6), [
    ['optical-0-1', 100], ['electric-0-1', 20], ['electric-2-0', 20],
    ['optical-2-3', 20], ['electric-0-2', 9], ['optical-3-2', 9],
  ]);
  assert.ok(initial.rates.slice(6).every(([, rate]) => rate === 0));
  assert.equal(initial.empty, '等待首次策略切换');
  const table = desktop.locator('.table-scroll');
  const before = await table.evaluate(node => {
    node.scrollTop = 49;
    return node.scrollTop;
  });
  await desktop.evaluate(() => showFixture('switched'));
  const switched = await read(desktop);
  assert.equal(switched.strategy, 'B');
  assert.deepEqual(switched.ticks, ['10', '10', '10', '10']);
  assert.deepEqual(switched.pairs, ['0-2', '1-3']);
  assert.deepEqual(switched.events, [{ from: 'A', to: 'B', tick: '10', time: '2026-11-21T09:00:10.000Z', pairs: switched.pairs }]);
  assert.ok(before > 0);
  assert.equal(await table.evaluate(node => node.scrollTop), before);
  console.log('U2 PASS', { initialRates: initial.rates, switchedEvents: switched.events, retainedScrollTop: before });

  await table.evaluate(node => { node.scrollTop = 0; });
  await desktop.screenshot({ path: join(evidence, 'desktop-1440x900.png') });
  const narrow = await browser.newPage({ viewport: narrowSize, reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai' });
  narrow.on('pageerror', error => errors.push(error.message));
  await narrow.goto(url);
  await narrow.locator('[data-mems]').waitFor();
  await narrow.evaluate(() => showFixture('switched'));
  const metrics = await narrow.evaluate(() => {
    const diagram = document.querySelector('.diagram-scroll');
    const table = document.querySelector('.table-scroll');
    const last = table.querySelector('tbody tr:last-child td:last-child');
    diagram.scrollLeft = diagram.scrollWidth;
    table.scrollTop = table.scrollHeight;
    return {
      page: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
      viewportWidth: innerWidth,
      diagramScroll: diagram.scrollLeft,
      tableScroll: table.scrollTop,
      lastRateVisible: last.getBoundingClientRect().bottom <= table.getBoundingClientRect().bottom,
      tableWidth: [table.scrollWidth, table.clientWidth],
      rows: table.querySelectorAll('tbody tr').length,
      eventsBelowTable: document.querySelector('.events').offsetTop > table.offsetTop,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      arrows: document.querySelectorAll('.flow-arrow').length,
    };
  });
  assert.equal(metrics.viewportWidth, 390);
  assert.equal(metrics.page[0], metrics.page[1]);
  assert.ok(metrics.diagramScroll > 0 && metrics.tableScroll > 0);
  assert.equal(metrics.tableWidth[0], metrics.tableWidth[1]);
  assert.ok(metrics.lastRateVisible && metrics.eventsBelowTable && metrics.reduced && metrics.arrows > 0);
  assert.equal(metrics.rows, 16);
  assert.deepEqual(errors, []);
  await narrow.evaluate(() => {
    document.querySelector('.diagram-scroll').scrollLeft = 0;
    document.querySelector('.table-scroll').scrollTop = 0;
  });
  await narrow.screenshot({ path: join(evidence, 'narrow-390x844.png') });
  await narrow.screenshot({ path: join(evidence, 'narrow-full.png'), fullPage: true });
  console.log('U3 objective PASS', { desktopSize, narrowSize, metrics, errors, screenshot: 'switched' });
} finally {
  await browser.close();
  await server.close();
}
