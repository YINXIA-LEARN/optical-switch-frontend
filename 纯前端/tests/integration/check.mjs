import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer } from './static-server.mjs';

const evidence = process.env.OPTICAL_INTEGRATION_EVIDENCE ?? '.handoff/tasks/T03/evidence/a1';
const desktopSize = { width: 1440, height: 900 };
const narrowSize = { width: 390, height: 844 };
const nestedPath = '/exhibit/relocated/network/';
const expectedEdges = ['0-1', '0-2', '0-3', '1-2', '1-3', '2-3'];
const expectedPairs = {
  A: ['0-1', '2-3'],
  B: ['0-2', '1-3'],
  C: ['0-3', '1-2'],
};

const save = (name, value) => writeFile(join(evidence, name), JSON.stringify(value, null, 2) + '\n');
const shot = (page, name, fullPage = false) => page.screenshot({ path: join(evidence, name), fullPage });
const directions = (medium, ids) => ids.flatMap(id => {
  const [a, b] = id.split('-');
  return [`${medium}-${a}-${b}`, `${medium}-${b}-${a}`];
}).sort();

function installObserver() {
  const all = selector => [...document.querySelectorAll(selector)];
  const data = (selector, field) => all(selector).map(element => element.dataset[field]);
  window.sampleHistory = [];
  window.visibilityHistory = [];
  document.addEventListener('visibilitychange', () => visibilityHistory.push(document.visibilityState));

  window.readDashboard = () => {
    const header = document.querySelector('[data-view="header"]');
    const tick = Number(header.dataset.tick);
    return {
      tick,
      time: header.querySelector('time').dateTime,
      clockText: header.querySelector('time').textContent,
      strategy: header.querySelector('[data-strategy]').textContent,
      views: data('[data-view]', 'tick').map(Number),
      racks: data('[data-tor]', 'tor'),
      ports: all('[data-tor] [data-port]').length,
      electric: data('[data-electric-edge]:has(.electric-base)', 'electricEdge'),
      drops: data('[data-optical-drop]', 'opticalDrop'),
      optical: data('[data-mems] [data-optical-pair]:has(.optical-base)', 'opticalPair'),
      plotted: all('[data-flow]').map(element => ({
        id: element.dataset.flow,
        rate: Number(element.dataset.rate),
        active: element.dataset.active === 'true',
        arrow: !!element.querySelector('.flow-arrow'),
        movingDot: !!element.querySelector('.flow-dot'),
      })),
      rows: all('[data-path]').map(element => ({
        id: element.dataset.path, rate: Number(element.dataset.rate),
        visibleRate: Number(element.querySelector('.rate-cell > span:last-child').textContent),
      })),
      events: all('[data-event-tick]').map(element => ({
        tick: Number(element.dataset.eventTick),
        time: element.querySelector('time').dateTime,
        clockText: element.querySelector('time').textContent,
        transition: element.querySelector('strong').textContent,
        pairs: [...element.querySelectorAll('[data-event-pair]')].map(pair => pair.dataset.eventPair),
        pairText: [...element.querySelectorAll('[data-event-pair]')].map(pair => pair.textContent),
      })),
      visibility: document.visibilityState,
    };
  };

  let lastSignature;
  new MutationObserver(() => {
    if (!document.querySelector('[data-view="events"]')) return;
    const frame = readDashboard();
    const signature = JSON.stringify(frame);
    if (signature === lastSignature) return;
    lastSignature = signature;
    sampleHistory.push({ ...frame, elapsedMs: performance.now() });
  }).observe(document, { childList: true, subtree: true, attributes: true, characterData: true });
}

function validateFrame(frame, expectedElectric, optical, rackCount) {
  assert.deepEqual(frame.views, Array(4).fill(frame.tick));
  assert.equal(frame.racks.length, rackCount);
  assert.equal(new Set(frame.racks).size, rackCount);
  assert.equal(frame.ports, rackCount * 4);
  assert.equal(frame.drops.length, rackCount);
  assert.deepEqual(frame.electric, expectedElectric);
  assert.deepEqual(frame.optical, optical);
  const expectedIds = [...directions('electric', expectedElectric), ...directions('optical', optical)].sort();
  assert.equal(frame.rows.length, rackCount * 4);
  assert.deepEqual(frame.rows.map(row => row.id).sort(), expectedIds);
  assert.deepEqual(frame.plotted.map(flow => flow.id).sort(), expectedIds);
  assert.deepEqual(frame.rows, [...frame.rows].sort((a, b) => b.rate - a.rate || a.id.localeCompare(b.id, 'en')));
  const plotted = new Map(frame.plotted.map(flow => [flow.id, flow]));
  for (const { id, rate, visibleRate } of frame.rows) {
    assert.ok(Number.isInteger(rate) && rate >= 0 && rate <= 100);
    assert.equal(visibleRate, rate);
    assert.deepEqual(plotted.get(id), { id, rate, active: rate > 0, arrow: rate > 0, movingDot: rate > 0 });
  }
}

function verifySwitch(frames, tick, from, to, pairs) {
  const before = frames[tick - 1];
  const after = frames[tick];
  assert.equal(before.strategy, from);
  assert.equal(after.strategy, to);
  const oldPaths = directions('optical', before.optical);
  assert.ok(after.plotted.every(flow => !oldPaths.includes(flow.id)));
  assert.deepEqual(after.electric, before.electric);
  assert.deepEqual(after.events[0], {
    tick, time: after.time, clockText: after.clockText, transition: `${from} → ${to}`, pairs,
    pairText: pairs.map(pair => pair.split('-').map(id => `ToR${id}`).join(' ↔ ')),
  });
  return {
    tick, removed: oldPaths, added: directions('optical', after.optical),
    electricIds: directions('electric', after.electric), event: after.events[0],
  };
}

async function inspectAssets() {
  const assets = [];
  for (const file of await readdir('dist', { recursive: true, withFileTypes: true })) {
    if (!file.isFile()) continue;
    const local = join(file.parentPath, file.name);
    const bytes = await readFile(local);
    assets.push({
      path: local.replaceAll('\\', '/').slice('dist/'.length),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  return assets.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

async function openPage(context, url, viewport, clock = false) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  if (clock) await page.clock.install({ time: new Date('2026-11-21T09:00:00.000Z') });
  await page.bringToFront();
  await page.goto(url);
  await page.locator('[data-tor]').first().waitFor();
  return page;
}

async function verifyExpandedWiring(page) {
  const routing = await page.evaluate(() => {
    const core = document.querySelector('.core-body').getBBox();
    const inside = ({ x, y }) => x > core.x && x < core.x + core.width && y > core.y && y < core.y + core.height;
    const collect = (selector, field, expectedInside) => [...document.querySelectorAll(selector)].flatMap(path => {
      const length = path.getTotalLength();
      for (let distance = 3; distance < length - 3; distance += 3) {
        if (inside(path.getPointAtLength(distance)) !== expectedInside) {
          return [path.parentElement.dataset[field]];
        }
      }
      return [];
    });
    return {
      electricUnderCore: collect('.electric-base', 'electricEdge', false),
      opticalOutsideCore: collect('.optical-pair .optical-base', 'opticalPair', true),
    };
  });
  assert.deepEqual(routing, { electricUnderCore: [], opticalOutsideCore: [] });
  return routing;
}

await mkdir(evidence, { recursive: true });
const assets = await inspectAssets();
const temporary = await mkdtemp(join(resolve(tmpdir()), 'optical-dashboard-'));
const copy = join(temporary, ...nestedPath.split('/').filter(Boolean));
let server;
let browser;

try {
  await mkdir(dirname(copy), { recursive: true });
  await cp('dist', copy, { recursive: true });
  server = await startStaticServer(temporary);
  browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'Asia/Shanghai' });
  await context.addInitScript(installObserver);
  const blocked = [];
  const requests = [];
  const errors = [];
  await context.route('**/*', route => {
    const requestUrl = route.request().url();
    if (new URL(requestUrl).origin === server.origin) return route.continue();
    blocked.push(requestUrl);
    return route.abort('blockedbyclient');
  });
  context.on('response', response => requests.push({ url: response.url(), status: response.status() }));
  context.on('weberror', error => errors.push(error.error().message));
  context.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const url = server.origin + nestedPath;
  const startedAt = new Date().toISOString();
  const desktop = await openPage(context, url, desktopSize);
  const assetChecks = {
    startedAt, cwd: process.cwd(), node: process.version, chrome: browser.version(),
    copiedDist: copy, url, assets, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
  };
  assert.equal(await desktop.title(), '光电网络总览');
  assert.deepEqual((await desktop.evaluate(() => readDashboard())).racks, ['0', '1', '2', '3']);
  for (const asset of assets) {
    const wanted = asset.path === 'index.html' ? url : url + asset.path;
    assert.ok(requests.some(request => request.url === wanted && request.status === 200), wanted);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(blocked, []);
  await save('I1-deployment.json', { ...assetChecks, requests: [...requests], outsideNetworkBlocked: true, blocked, errors });
  console.log('I1 PASS', { url, bytes: assetChecks.bytes, files: assets.map(asset => asset.path) });

  // This page keeps its real browser timer and remains in front through both transitions.
  for (const tick of [9, 10, 19, 20, 21]) {
    await desktop.waitForFunction(tick => Number(document.querySelector('[data-view="header"]').dataset.tick) === tick, tick, { timeout: 13000 });
    await shot(desktop, tick === 21 ? 'desktop-1440x900.png' : `desktop-tick-${tick}.png`);
  }
  const actualForegroundMs = await desktop.evaluate(() => Math.round(performance.now() - sampleHistory[0].elapsedMs));
  const frames = await desktop.evaluate(() => sampleHistory.filter(sample => sample.tick <= 21));
  assert.deepEqual(frames.map(frame => frame.tick), Array.from({ length: 22 }, (_, index) => index));
  assert.deepEqual(await desktop.evaluate(() => visibilityHistory), []);
  const intervals = [];
  for (const frame of frames) {
    const strategy = frame.tick < 10 ? 'A' : frame.tick < 20 ? 'B' : 'C';
    assert.equal(frame.strategy, strategy);
    assert.equal(frame.visibility, 'visible');
    assert.equal(Date.parse(frame.time) - Date.parse(frames[0].time), frame.tick * 1000);
    assert.deepEqual(frame.events.map(event => event.tick), frame.tick >= 20 ? [20, 10] : frame.tick >= 10 ? [10] : []);
    validateFrame(frame, expectedEdges, expectedPairs[strategy], 4);
    if (frame.tick > 0) {
      const interval = Math.round(frame.elapsedMs - frames[frame.tick - 1].elapsedMs);
      assert.ok(interval >= 800 && interval <= 1250, `tick ${frame.tick} interval ${interval} ms`);
      intervals.push(interval);
    }
  }
  const observedMs = Math.round(frames.at(-1).elapsedMs - frames[0].elapsedMs);
  assert.ok(actualForegroundMs >= 21000, `real foreground time ${actualForegroundMs} ms`);
  const switches = [
    verifySwitch(frames, 10, 'A', 'B', expectedPairs.B),
    verifySwitch(frames, 20, 'B', 'C', expectedPairs.C),
  ];
  assert.deepEqual(frames[21].events[1], frames[10].events[0]);
  await save('I2-foreground.json', { url, startedAt, actualForegroundMs, observedMs, intervals, switches, expectedKeyTicks: [0, 1, 9, 10, 11, 19, 20, 21], frames });
  console.log('I2 PASS', { actualForegroundMs, observedMs, ticks: [0, 21], events: switches.map(item => item.event.transition) });
  await desktop.close();

  const narrow = await openPage(context, url, narrowSize, true);
  await narrow.clock.runFor(20500);
  const narrowFrame = await narrow.evaluate(() => readDashboard());
  validateFrame(narrowFrame, expectedEdges, expectedPairs.C, 4);
  assert.deepEqual(narrowFrame.events.map(event => event.transition), ['B → C', 'A → B']);
  const scroll = await narrow.evaluate(() => {
    const diagram = document.querySelector('.diagram-scroll');
    const table = document.querySelector('.table-scroll');
    table.scrollTop = table.scrollHeight;
    diagram.scrollLeft = diagram.scrollWidth;
    const last = table.querySelector('tbody tr:last-child td:last-child');
    const tableHead = table.querySelector('thead').getBoundingClientRect();
    const tableBox = table.getBoundingClientRect();
    const data = {
      viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
      pageClientWidth: document.documentElement.clientWidth,
      localDiagramScroll: diagram.scrollLeft, localTableScroll: table.scrollTop,
      tableFits: table.scrollWidth === table.clientWidth,
      lastRateVisible: last.getBoundingClientRect().bottom <= tableBox.bottom,
      stickyHeader: Math.abs(tableHead.top - tableBox.top) < 3,
    };
    diagram.scrollLeft = 0;
    table.scrollTop = 0;
    return data;
  });
  assert.equal(scroll.viewport, narrowSize.width);
  assert.equal(scroll.pageWidth, scroll.pageClientWidth);
  assert.ok(scroll.localDiagramScroll > 0 && scroll.localTableScroll > 0);
  assert.ok(scroll.tableFits && scroll.lastRateVisible && scroll.stickyHeader);
  await shot(narrow, 'narrow-390x844.png');
  await shot(narrow, 'narrow-full.png', true);
  await narrow.close();

  const expanded = await openPage(context, url + '?tors=8', desktopSize, true);
  const expandedInitial = await expanded.evaluate(() => readDashboard());
  const expandedEdges = [...expectedEdges, '4-5', '4-6', '4-7', '5-6', '5-7', '6-7'];
  validateFrame(expandedInitial, expandedEdges, ['0-1', '2-3', '4-5', '6-7'], 8);
  await expanded.clock.runFor(10500);
  const expandedB = await expanded.evaluate(() => readDashboard());
  validateFrame(expandedB, expandedEdges, ['0-4', '1-5', '2-6', '3-7'], 8);
  assert.equal(expandedB.strategy, 'B');
  assert.deepEqual(expandedB.events[0].pairs, expandedB.optical);
  const routingB = await verifyExpandedWiring(expanded);
  await shot(expanded, 'expanded-8-tor.png', true);
  await expanded.clock.runFor(10000);
  const expandedC = await expanded.evaluate(() => readDashboard());
  validateFrame(expandedC, expandedEdges, ['0-7', '1-6', '2-5', '3-4'], 8);
  assert.equal(expandedC.strategy, 'C');
  assert.deepEqual(expandedC.events.map(event => event.transition), ['B → C', 'A → B']);
  assert.deepEqual(expandedC.events[0].pairs, expandedC.optical);
  const routingC = await verifyExpandedWiring(expanded);
  await shot(expanded, 'expanded-8-tor-strategy-c.png', true);
  assert.deepEqual(errors, []);
  assert.deepEqual(blocked, []);
  await save('I3-responsive-expansion.json', {
    desktopSize, narrowSize, scroll, narrowTick: narrowFrame.tick, narrowEvents: narrowFrame.events,
    expanded: [expandedInitial, expandedB, expandedC], routingB, routingC,
  });
  console.log('I3 PASS', { viewport: narrowSize, rows: expandedB.rows.length, crossGroup: expandedB.optical, errors });
} finally {
  try {
    await browser?.close();
    await server?.close();
  } finally {
    if (dirname(temporary) === resolve(tmpdir()) && basename(temporary).startsWith('optical-dashboard-')) {
      await rm(temporary, { recursive: true, force: true });
    }
  }
}
