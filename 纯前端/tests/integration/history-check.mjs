import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { summarizeMinute } from '../../src/analytics/aggregate.mjs';
import { createHistorySample } from '../../src/analytics/sample.mjs';
import { defaultConfig } from '../../src/sim/config.mjs';
import { startStaticServer } from './static-server.mjs';

const evidence = process.env.HISTORY_EVIDENCE_DIR ?? '.handoff/tasks/T05/evidence/a1';
const minuteSelector = '[data-history-minute]';
const matrixSelector = '[data-history-matrix]';
const expected = createHistorySample(defaultConfig);
const start = expected.samples[0].timeMs;
const desktopSize = { width: 1440, height: 900 };
const narrowSize = { width: 390, height: 844 };
const screenshot = (locator, file) => locator.screenshot({ path: join(evidence, file), scale: 'css' });
const byId = locator => locator.getAttribute('data-tick').then(Number);

async function readMinute(page) {
  return page.locator(minuteSelector).evaluate(section => {
    const all = selector => [...section.querySelectorAll(selector)];
    const number = (node, field) => Number(node.dataset[field]);
    return {
      start: number(section, 'startMs'),
      end: number(section, 'endMs'),
      optical: number(section, 'opticalShare'),
      electric: number(section, 'electricShare'),
      points: all('[data-trend]').map(path => path.getAttribute('d').match(/[ML]/g).length),
      paths: all('[data-trend]').map(path => path.getAttribute('d')),
      cuts: all('[data-strategy-cut]').map(group => number(group, 'strategyCut')),
      segments: all('[data-minute-segment]').map(row => ({
        id: row.dataset.minuteSegment,
        seconds: number(row, 'seconds'),
        optical: number(row, 'opticalShare'),
        electric: number(row, 'electricShare'),
      })),
      latest: number(section.querySelector('[data-sample-ms]'), 'sampleMs'),
      racks: all('[data-history-rack]').map(row => ({
        id: number(row, 'historyRack'), sent: number(row, 'sent'), received: number(row, 'received'),
        bars: [...row.querySelectorAll('.rack-track')].map(track =>
          [...track.children].map(piece => piece.getBoundingClientRect().width / track.getBoundingClientRect().width)),
      })),
      button: section.querySelector('.history-button').textContent.trim(),
    };
  });
}

function verifyMinute(frame, offset) {
  const target = summarizeMinute(expected.samples.slice(offset, offset + 60), expected.rackIds);
  assert.equal(frame.start, start + offset * 1000);
  assert.equal(frame.end - frame.start, 60_000);
  assert.equal(frame.latest, frame.end - 1000);
  assert.deepEqual(frame.points, [60, 60]);
  assert.deepEqual(frame.cuts, target.segments.slice(1).map(segment => segment.startMs));
  assert.deepEqual(frame.segments, target.segments.map(segment => ({
    id: segment.strategyId, seconds: segment.seconds, optical: segment.shares.optical, electric: segment.shares.electric,
  })));
  assert.equal(frame.segments.reduce((sum, segment) => sum + segment.seconds, 0), 60);
  assert.equal(frame.optical, target.shares.optical);
  assert.equal(frame.electric, target.shares.electric);
  const scale = Math.max(1, ...target.rackRates.flatMap(rack => [rack.sent, rack.received]));
  assert.equal(frame.racks.length, target.rackRates.length);
  for (const [index, rack] of target.rackRates.entries()) {
    const { bars, ...readout } = frame.racks[index];
    assert.deepEqual(readout, { id: rack.id, sent: rack.sent, received: rack.received });
    assert.equal(bars.length, 2);
    for (const [i, media] of [rack.sentByMedium, rack.receivedByMedium].entries()) {
      assert.equal(bars[i].length, 2);
      assert.ok(Math.abs(bars[i][0] - media.optical / scale) < 0.001);
      assert.ok(Math.abs(bars[i][1] - media.electric / scale) < 0.001);
    }
  }
}

async function readMatrix(page) {
  return page.locator(matrixSelector).evaluate(section => {
    const all = selector => [...section.querySelectorAll(selector)];
    const legend = section.querySelector('.matrix-legend');
    return {
      id: section.dataset.strategy,
      start: +section.dataset.sectionStart,
      end: +section.dataset.sectionEnd,
      effectiveStart: +section.dataset.effectiveStart,
      effectiveEnd: +section.dataset.effectiveEnd,
      totalGbit: +section.dataset.totalGbit,
      title: section.querySelector('.matrix-toolbar h3').textContent,
      range: section.querySelector('.matrix-toolbar p').textContent,
      boundaryTimes: all('.timeline-node time').map(time => time.textContent),
      legend: [...legend.querySelectorAll('i')].map(swatch => ({
        band: swatch.dataset.band, color: getComputedStyle(swatch).backgroundColor,
      })),
      axes: all('.matrix-axis th, thead tr:last-child th:first-child').map(node => node.textContent),
      tableWidth: section.querySelector('.matrix-table').getBoundingClientRect().width,
      rows: all('tbody tr').length,
      columns: all('thead tr:last-child th').length - 1,
      diagonals: all('.matrix-diagonal').length,
      selection: section.querySelector('[data-matrix-detail]').dataset.matrixDetail,
      cells: all('[data-matrix-cell]').map(cell => ({
        id: cell.dataset.matrixCell,
        share: +cell.dataset.share,
        amount: +cell.dataset.gbit,
        band: cell.dataset.band,
        color: getComputedStyle(cell).backgroundColor,
      })),
    };
  });
}

function verifyMatrix(matrix, index) {
  const section = expected.matrices[index];
  assert.equal(matrix.id, section.strategyId);
  assert.equal(matrix.start, section.startMs);
  assert.equal(matrix.end - matrix.start, 3600_000);
  assert.equal(matrix.effectiveStart, section.effectiveStartMs);
  assert.equal(matrix.effectiveEnd, section.effectiveEndMs);
  assert.equal(matrix.effectiveStart - matrix.start, 300_000);
  assert.equal(matrix.end - matrix.effectiveEnd, 300_000);
  assert.match(matrix.title, new RegExp(`策略 ${matrix.id} · 0?${8 + index}:00`));
  assert.match(matrix.range, new RegExp(`0?${8 + index}:05 ≤ t < 0?${8 + index}:55`));
  assert.equal(matrix.totalGbit, section.totalGbit);
  assert.deepEqual(matrix.boundaryTimes, ['08:00', '09:00', '10:00', '11:00']);
  assert.deepEqual([matrix.rows, matrix.columns, matrix.diagonals, matrix.cells.length], [4, 4, 4, 12]);
  assert.deepEqual(matrix.axes, ['接收端（列）→', '发送端 ↓']);
  assert.ok(matrix.tableWidth < 500);
  assert.equal(new Set(matrix.legend.map(item => item.color)).size, 5);
  assert.ok(Math.abs(matrix.cells.reduce((sum, cell) => sum + cell.share, 0) - 1) < 1e-12);
  for (const cell of matrix.cells) {
    const index = [0, 0.05, 0.10, 0.20, 1].findIndex(limit => cell.share <= limit);
    assert.equal(cell.band, matrix.legend[index].band);
    assert.equal(cell.color, matrix.legend[index].color);
  }
  const active = matrix.cells.toSorted((a, b) => b.share - a.share)[0];
  assert.equal(matrix.selection, active.id);
  assert.equal(active.share, section.maxShare);
  const reverse = matrix.cells.find(cell => cell.id === active.id.split('-').reverse().join('-'));
  assert.ok(active.amount > reverse.amount);
  const zero = matrix.cells.find(cell => cell.share === 0);
  assert.ok(zero && zero.color !== active.color);
  return { hot: active.id, reverse: reverse.share, zeroColor: zero.color };
}

async function bounds(page) {
  return page.evaluate(() => {
    const table = document.querySelector('.matrix-scroll');
    const wrapping = document.querySelector('.minute-layout');
    const chart = wrapping.querySelector('.throughput-chart').getBoundingClientRect();
    const racks = wrapping.querySelector('.history-racks').getBoundingClientRect();
    const last = table.querySelector('thead tr:last-child th:last-child');
    const initial = table.scrollLeft;
    table.scrollLeft = table.scrollWidth;
    const result = {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      chartWidth: chart.width,
      chartAboveRacks: chart.bottom <= racks.top,
      scroll: table.scrollLeft,
      lastColumnAtRight: Math.round(last.getBoundingClientRect().right) <= Math.round(table.getBoundingClientRect().right),
    };
    table.scrollLeft = initial;
    return result;
  });
}

await mkdir(evidence, { recursive: true });
const temporary = await mkdtemp(join(resolve(tmpdir()), 'optical-history-'));
let server;
let browser;
try {
  await cp('dist', join(temporary, 'history'), { recursive: true });
  server = await startStaticServer(temporary);
  const url = server.origin + '/history/';
  browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const rejected = [];
  const errors = [];
  const requests = [];
  await context.route('**/*', route => {
    const requestUrl = route.request().url();
    if (new URL(requestUrl).origin === server.origin) return route.continue();
    rejected.push(requestUrl);
    return route.abort();
  });
  context.on('response', response => requests.push({ url: response.url(), status: response.status() }));
  context.on('weberror', error => errors.push(error.error().message));
  context.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  const desktop = await context.newPage();
  await desktop.setViewportSize(desktopSize);
  await desktop.bringToFront();
  await desktop.goto(url);
  const minute = desktop.locator(minuteSelector);
  const matrix = desktop.locator(matrixSelector);
  await minute.waitFor();
  assert.equal(await desktop.getByText('历史样例', { exact: true }).count(), 2);
  const helpButtons = desktop.locator('.module-help-button');
  assert.equal(await helpButtons.count(), 8);
  for (const button of await helpButtons.all()) {
    await button.hover();
    const tip = desktop.locator('#' + await button.getAttribute('aria-describedby'));
    await tip.waitFor({ state: 'visible' });
    assert.ok((await tip.innerText()).length > 12);
  }
  const topologyHelp = desktop.getByRole('button', { name: '网络拓扑帮助' });
  await desktop.getByRole('button', { name: '光电网络总览帮助' }).focus();
  await desktop.keyboard.press('Tab');
  assert.ok(await topologyHelp.evaluate(node => node === document.activeElement));
  await desktop.locator('#help-topology').waitFor({ state: 'visible' });
  await desktop.keyboard.press('Escape');
  await desktop.locator('#help-topology').waitFor({ state: 'hidden' });
  await desktop.evaluate(() => window.scrollTo(0, 0));
  await topologyHelp.hover();
  await desktop.locator('#help-topology').waitFor({ state: 'visible' });
  await desktop.screenshot({ path: join(evidence, 'desktop-overview-help.png'), scale: 'css' });
  await desktop.keyboard.press('Escape');
  await desktop.mouse.move(0, 0);
  const timing = await desktop.evaluate(() => {
    const live = document.querySelector('[data-view="topology"]');
    const section = document.querySelector('[data-history-minute]');
    const samples = [{ at: performance.now(), start: +section.dataset.startMs }];
    const observer = new MutationObserver(() => samples.push({
      at: performance.now(), start: +section.dataset.startMs, liveTick: +live.dataset.tick,
    }));
    observer.observe(section, { attributes: true, attributeFilter: ['data-start-ms'] });
    window.historyObservations = samples;
    return +live.dataset.tick;
  });
  const initial = await readMinute(desktop);
  verifyMinute(initial, 0);
  await screenshot(minute, 'desktop-minute.png');
  assert.equal(await matrix.getByRole('button', { name: '经典渐变' }).getAttribute('aria-pressed'), 'true');
  assert.ok(await matrix.locator('.matrix-gradient-scale').isVisible());
  assert.ok(await matrix.locator('.matrix-table').evaluate(table => table.clientWidth > 1000));
  await screenshot(matrix, 'desktop-matrix-classic.png');
  await matrix.getByRole('button', { name: '紧凑分档' }).click();
  const initialMatrix = await readMatrix(desktop);
  assert.equal(initialMatrix.id, 'B');
  await screenshot(matrix, 'desktop-matrix-b.png');
  await desktop.mouse.move(0, 0);
  await minute.getByRole('button', { name: '播放样例' }).click();
  const advanced = [initial];
  for (const step of [1, 2]) {
    await desktop.waitForFunction(({ selector, wanted }) => +document.querySelector(selector).dataset.startMs === wanted,
      { selector: minuteSelector, wanted: start + step * 1000 });
    const frame = await readMinute(desktop);
    verifyMinute(frame, step);
    assert.notDeepEqual(frame.paths, advanced.at(-1).paths);
    advanced.push(frame);
  }
  await minute.getByRole('button', { name: '暂停样例' }).click();
  await desktop.waitForTimeout(1120);
  const paused = await readMinute(desktop);
  assert.deepEqual(paused, { ...advanced[2], button: initial.button });
  const observations = await desktop.evaluate(() => historyObservations);
  assert.deepEqual(observations.map(entry => entry.start), advanced.map(entry => entry.start));
  assert.ok(Math.abs(observations[2].at - observations[1].at - 1000) < 200);
  assert.ok(await byId(desktop.locator('[data-view="topology"]')) > timing);
  assert.equal(await desktop.locator('tr[data-path]').count(), 16);
  await screenshot(minute, 'desktop-minute-paused.png');
  console.log('B2 PASS', { windows: advanced.map(frame => [frame.start, frame.end]), stageSeconds: advanced.map(frame => frame.segments.map(segment => segment.seconds)) });

  const matrices = [];
  const colors = [];
  const hotspots = [];
  for (const [index, strategy] of ['A', 'B', 'C'].entries()) {
    await matrix.locator(`[data-history-interval="${strategy}"]`).click();
    const frame = await readMatrix(desktop);
    const checks = verifyMatrix(frame, index);
    colors.push(checks.zeroColor);
    hotspots.push(checks.hot);
    matrices.push(frame);
  }
  assert.equal(new Set(colors).size, 1);
  for (const frame of matrices) assert.deepEqual(frame.legend, matrices[0].legend);
  assert.deepEqual(hotspots, ['0-1', '2-0', '0-3']);
  const reverseCell = matrix.locator('[data-matrix-cell="3-0"]');
  await reverseCell.focus();
  assert.deepEqual(await matrix.locator('.matrix-axis-active').allTextContents(), ['ToR0', 'ToR3']);
  assert.equal(await matrix.locator('[data-matrix-detail]').getAttribute('data-matrix-detail'), '3-0');
  assert.match(await matrix.locator('[data-matrix-detail]').textContent(), /GB/);
  for (const name of ['经典渐变', '紧凑分档']) {
    await matrix.getByRole('button', { name }).click();
    assert.equal(await matrix.getAttribute('data-strategy'), 'C');
    assert.equal(await matrix.locator('[data-matrix-detail]').getAttribute('data-matrix-detail'), '3-0');
  }
  assert.equal((await readMinute(desktop)).start, paused.start);
  await matrix.locator('[data-history-interval="C"]').click();
  await screenshot(matrix, 'desktop-matrix-c.png');
  await desktop.screenshot({ path: join(evidence, 'desktop-full.png'), fullPage: true, scale: 'css' });
  console.log('B3 PASS', { hotspots, bands: matrices[0].legend.length, tableWidth: matrices[0].tableWidth });

  const mobileContext = await browser.newContext({ viewport: narrowSize, hasTouch: true, serviceWorkers: 'block' });
  mobileContext.on('weberror', error => errors.push(error.error().message));
  const narrow = await mobileContext.newPage();
  await narrow.goto(url);
  await narrow.locator(minuteSelector).waitFor();
  await narrow.getByRole('button', { name: 'ToR 收发速率帮助' }).tap();
  const mobileTip = narrow.locator('#help-racks');
  await mobileTip.waitFor({ state: 'visible' });
  const tipBounds = await mobileTip.boundingBox();
  assert.ok(tipBounds.x >= 0 && tipBounds.x + tipBounds.width <= narrowSize.width);
  await narrow.locator('#history-rack-heading').tap();
  await mobileTip.waitFor({ state: 'hidden' });
  const narrowMetrics = await bounds(narrow);
  assert.equal(narrowMetrics.viewport, 390);
  assert.equal(narrowMetrics.documentWidth, narrowMetrics.documentClientWidth);
  assert.ok(narrowMetrics.chartAboveRacks && narrowMetrics.chartWidth >= 285 && narrowMetrics.lastColumnAtRight);
  assert.equal(narrowMetrics.scroll, 0);
  const mobileCell = narrow.locator('[data-matrix-cell="0-2"]');
  await mobileCell.tap();
  assert.equal(await narrow.locator('[data-matrix-detail]').getAttribute('data-matrix-detail'), '0-2');
  await screenshot(narrow.locator(minuteSelector), 'narrow-minute.png');
  await screenshot(narrow.locator(matrixSelector), 'narrow-matrix.png');
  await narrow.screenshot({ path: join(evidence, 'narrow-full.png'), fullPage: true, scale: 'css' });

  const expanded = await context.newPage();
  await expanded.setViewportSize(desktopSize);
  await expanded.clock.install();
  await expanded.goto(url + '?tors=8');
  await expanded.locator(minuteSelector).waitFor();
  const expandedMinute = await readMinute(expanded);
  assert.ok(await expanded.locator('.matrix-gradient-scale').isVisible());
  await expanded.getByRole('button', { name: '紧凑分档' }).click();
  const expandedMatrix = await readMatrix(expanded);
  assert.equal(expandedMinute.racks.length, 8);
  assert.deepEqual([expandedMatrix.rows, expandedMatrix.columns, expandedMatrix.diagonals, expandedMatrix.cells.length], [8, 8, 8, 56]);
  assert.equal(await expanded.locator('tr[data-path]').count(), 32);
  await screenshot(expanded.locator(minuteSelector), 'expanded-minute.png');
  await screenshot(expanded.locator(matrixSelector), 'expanded-matrix.png');
  await expanded.setViewportSize(narrowSize);
  const expandedNarrow = await bounds(expanded);
  assert.equal(expandedNarrow.documentWidth, expandedNarrow.documentClientWidth);
  assert.ok(expandedNarrow.scroll > 0 && expandedNarrow.lastColumnAtRight);

  await expanded.locator(minuteSelector).getByRole('button', { name: '播放样例' }).click();
  await expanded.clock.runFor(61_100);
  const last = await readMinute(expanded);
  assert.equal(last.start, start + 60_000);
  assert.match(last.button, /重新播放/);
  assert.equal(last.segments.length, 1);
  assert.equal(last.segments[0].seconds, 60);
  await expanded.locator(minuteSelector).getByRole('button', { name: '重新播放' }).click();
  assert.equal((await readMinute(expanded)).start, start);

  const files = ['index.html', ...(await readdir('dist/assets')).map(file => 'assets/' + file)];
  const assets = await Promise.all(files.map(async file => {
    assert.ok(requests.some(request => request.url === url + (file === 'index.html' ? '' : file) && request.status === 200));
    return { file, bytes: (await stat(join('dist', file))).size };
  }));
  assert.deepEqual(rejected, []);
  assert.deepEqual(errors, []);
  const result = {
    time: new Date().toISOString(), url, chrome: browser.version(), assets, requests, rejected, errors,
    desktopSize, narrowSize, playback: { advanced, observations, paused, finalStart: last.start, restarted: true },
    matrices, narrowMetrics, expandedNarrow, expanded: { racks: expandedMinute.racks.length, matrix: expandedMatrix },
  };
  await writeFile(join(evidence, 'browser.json'), JSON.stringify(result, null, 2) + '\n');
  console.log('B4 PASS', { url, assets, narrowMetrics, expandedNarrow, expanded: [expandedMatrix.rows, expandedMatrix.columns] });
} finally {
  try {
    await browser?.close();
    await server?.close();
  } finally {
    if (dirname(temporary) === resolve(tmpdir()) && basename(temporary).startsWith('optical-history-')) {
      await rm(temporary, { recursive: true, force: true });
    }
  }
}
