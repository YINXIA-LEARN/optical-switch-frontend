import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';

const host = 'http://127.0.0.1:5173';
const dev = spawn(process.execPath, [
  'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js',
  'run', 'dev', '--', '--port', '5173', '--strictPort',
], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
dev.stderr.pipe(process.stderr);

try {
  await Promise.race([
    (async () => {
      for await (const chunk of dev.stdout) {
        process.stdout.write(chunk);
        if (chunk.toString().includes(host)) return;
      }
      throw new Error('Vite exited before becoming ready');
    })(),
    setTimeout(6000, undefined, { ref: false }).then(() => { throw new Error('Vite startup timed out'); }),
  ]);
  for (const path of ['/', '/src/main.jsx']) {
    const response = await fetch(host + path, { signal: AbortSignal.timeout(4000) });
    assert.equal(response.status, 200);
    const contents = await response.text();
    assert.match(contents, path === '/' ? /id="app"/ : /preact_jsx-dev-runtime|jsx-runtime/);
    console.log(`GET ${path} → ${response.status}; expected content found`);
  }
  console.log(new Date().toISOString(), process.version, 'dev smoke PASS');
} finally {
  const stop = spawn('taskkill.exe', ['/pid', String(dev.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
  await once(stop, 'exit');
}
