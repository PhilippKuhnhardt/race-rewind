import { spawn } from 'node:child_process';
import console from 'node:console';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';

const port = '4322';
const server = spawn(process.execPath, ['./dist/server/entry.mjs'], {
  env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: port },
  stdio: 'inherit',
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(`Production server exited before becoming ready (exit ${server.exitCode})`);
    }
    try {
      const response = await globalThis.fetch(`http://127.0.0.1:${port}/`, { signal: globalThis.AbortSignal.timeout(1000) });
      if (!response.ok) throw new Error(`Production homepage returned HTTP ${response.status}`);
      if (!(await response.text()).includes('Race Rewind')) throw new Error('Unexpected production homepage');
      ready = true;
      break;
    } catch (error) {
      if (error.cause?.code !== 'ECONNREFUSED') throw error;
      await setTimeout(500);
    }
  }
  if (!ready) throw new Error('Production server did not become ready');
  console.log('Production server smoke test passed.');
} finally {
  server.kill('SIGTERM');
}
