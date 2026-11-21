import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer } from './static-server.mjs';

const evidence = '.handoff/tasks/T04/evidence/a1';
const longest = 'electric-0-3';
const short = 'optical-0-1';
const bidirectional = [longest, 'electric-3-0', short, 'optical-1-0'];
const single = 'electric-0-2';
const active = [...bidirectional, single];
const paths = [
  'electric-0-1', 'electric-1-0', 'electric-0-2', 'electric-2-0', 'electric-0-3', 'electric-3-0',
  'electric-1-2', 'electric-2-1', 'electric-1-3', 'electric-3-1', 'electric-2-3', 'electric-3-2',
  'optical-0-1', 'optical-1-0', 'optical-2-3', 'optical-3-2',
];

await mkdir(evidence, { recursive: true });
const server = await startStaticServer('dist');
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.testRandomValue = 0.9;
    window.testDraws = [];
    Math.random = () => window.testDraws.shift() ?? window.testRandomValue;
  });
  await page.bringToFront();
  await page.goto(server.origin);
  const diagram = page.locator('.diagram-scroll');
  await diagram.waitFor();
  const topology = page.locator('[data-view="topology"]');
  const waitTick = tick => topology.and(page.locator(`[data-tick="${tick}"]`)).waitFor();
  await waitTick(2);
  // Seed the first targeted set after the page and its dependencies have initialized.
  await page.evaluate(draws => { window.testDraws = draws; }, paths.flatMap(id => active.includes(id) ? [0.1, 0.1] : [0.9]));
  await waitTick(3);

  const identify = await page.evaluate(() => {
    const all = selector => [...document.querySelectorAll(selector)];
    const route = (selector, field) => all(selector).map(node => [
      node.parentNode.dataset[field], node.getTotalLength(),
    ]).sort((a, b) => b[1] - a[1]);
    const dots = all('.flow-dot').map(dot => {
      const matrix = dot.getScreenCTM();
      const length = Math.hypot(matrix.a, matrix.b) * (2 * dot.r.baseVal.value + parseFloat(getComputedStyle(dot).strokeWidth));
      const motion = dot.querySelector('animateMotion');
      return { id: dot.parentElement.dataset.flow, length, seconds: motion.getSimpleDuration() };
    });
    return {
      tick: document.querySelector('[data-view="topology"]').dataset.tick,
      electric: route('.electric-base', 'electricEdge'),
      optical: route('.optical-pair .optical-base', 'opticalPair'),
      baseDrops: all('[data-optical-drop]').length,
      dots,
      activePaths: all('[data-flow][data-active=true]').map(node => node.dataset.flow),
      activityPaths: all('[data-flow] > path').map(node => node.getAttribute('class')),
    };
  });
  assert.equal(identify.tick, '3');
  assert.equal(identify.electric.length, 6);
  assert.equal(identify.electric[0][0], '0-3');
  assert.equal(identify.baseDrops, 4);
  assert.ok(identify.electric[0][1] > identify.optical[0][1] * 5);
  assert.deepEqual(identify.activePaths.sort(), active.toSorted());
  assert.deepEqual(identify.dots.map(dot => dot.id).sort(), active.toSorted());
  assert.deepEqual(identify.activityPaths, Array(active.length).fill('flow-arrow'));
  const longDot = identify.dots.find(dot => dot.id === longest);
  const shortDot = identify.dots.find(dot => dot.id === short);
  assert.ok(longDot.length >= 6 && shortDot.length >= 6);
  assert.ok(Math.abs(longDot.length - shortDot.length) <= 2);
  assert.ok(Math.abs(identify.electric[0][1] / longDot.seconds - identify.optical[0][1] / shortDot.seconds) < 1);

  const frameReader = page.evaluate(async ids => {
    const topology = document.querySelector('[data-view="topology"]');
    const directions = ids.map(id => topology.querySelector(`[data-flow="${id}"]`));
    const originals = directions.map(node => node.querySelector('.flow-dot'));
    const frames = [];
    do {
      await new Promise(requestAnimationFrame);
      frames.push({
        at: performance.now(),
        tick: Number(topology.dataset.tick),
        flows: directions.map((node, index) => {
          const original = originals[index];
          const transform = original.getCTM();
          const { x, y } = new DOMPoint(0, original.cy.baseVal.value).matrixTransform(transform);
          return {
            id: ids[index], rate: +node.dataset.rate, x, y,
            sameDot: node.querySelector('.flow-dot') === original,
          };
        }),
      });
    } while (frames.at(-1).tick < 5);
    return frames;
  }, bidirectional);

  const shots = [];
  for (let index = 1; index <= 3; index += 1) {
    const filename = `flow-frame-${index}.png`;
    const timing = await page.evaluate(() => ({
      wallMs: performance.now(),
      svgSeconds: document.querySelector('.diagram-scroll svg').getCurrentTime(),
      tick: Number(document.querySelector('[data-view="topology"]').dataset.tick),
    }));
    await diagram.screenshot({ path: join(evidence, filename), scale: 'css' });
    shots.push({ filename, ...timing });
    if (index < 3) await new Promise(resolve => setTimeout(resolve, 160));
  }
  const frames = await frameReader;
  const early = frames.filter(frame => frame.tick === 3).slice(0, 8);
  assert.ok(early.length >= 4);
  const start = early[0].flows;
  const farther = early.at(-1).flows;
  assert.ok(farther[0].x < start[0].x && farther[1].x > start[1].x, 'electric dots leave opposite sources');
  assert.ok(farther[2].x > start[2].x && farther[3].x < start[3].x, 'optical dots go in opposite directions');
  assert.ok(Math.abs(farther[2].y - farther[3].y) > 8, 'optical dots travel in distinct lanes');
  assert.ok(frames.every(frame => frame.flows.every(flow => flow.sameDot)));
  const next = frames.findIndex(frame => frame.tick === 4);
  assert.ok(next > 1);
  const first = frames[next - 1];
  const second = frames[next];
  const movementAtUpdate = second.flows.map((flow, index) => Math.hypot(flow.x - first.flows[index].x, flow.y - first.flows[index].y));
  assert.ok(first.flows.every(flow => flow.rate === 11));
  assert.ok(second.flows.every(flow => flow.rate === 91));
  assert.ok(movementAtUpdate.every(distance => distance > 0 && distance < 24), 'no reset or halt at rate update');
  assert.deepEqual(await page.locator('.flow-dot').count(), active.length);
  console.log('A1 PASS', { longest: identify.electric[0], short: identify.optical[0], longDot, shortDot, shots });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.flow-dot:visible').count(), 0);
  assert.equal(await page.locator('.flow-arrow:visible').count(), active.length);
  await diagram.screenshot({ path: join(evidence, 'reduced-motion.png'), scale: 'css' });
  await waitTick(6);
  assert.equal(await page.locator('.flow-dot, .flow-arrow').count(), 0);
  assert.equal(await page.locator('.electric-base').count(), 6);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { window.testRandomValue = 0.1; });
  await waitTick(9);
  const opticalDots = () => page.locator('[data-mems] [data-flow]:has(.flow-dot:visible)').evaluateAll(
    nodes => nodes.map(node => node.dataset.flow).sort(),
  );
  const retired = await opticalDots();
  assert.deepEqual(retired, paths.slice(12).sort());
  await waitTick(10);
  const installed = await opticalDots();
  assert.deepEqual(installed, ['optical-0-2', 'optical-1-3', 'optical-2-0', 'optical-3-1']);
  assert.equal(await page.locator('[data-from="A"][data-to="B"][data-event-tick="10"]').count(), 1);
  assert.deepEqual(errors, []);
  const run = {
    time: new Date().toISOString(), url: server.origin, chrome: browser.version(), identify, shots,
    movementAtUpdate, retired, installed, frames,
  };
  await writeFile(join(evidence, 'motion.json'), JSON.stringify(run, null, 2) + '\n');
  console.log('A2 PASS', { rateBefore: 11, rateAfter: 91, movementAtUpdate, activityTicks: [3, 6], switchTick: 10, retired, installed });
} finally {
  await browser?.close();
  await server.close();
}
