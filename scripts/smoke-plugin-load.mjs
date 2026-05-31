import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const tempDir = await mkdtemp(join(tmpdir(), 'openstellar-mcp-adapter-smoke-'));

try {
  const { stdout: packStdout } = await execFileAsync('npm', ['pack', '--silent'], {
    cwd: new URL('..', import.meta.url),
  });

  const tarball = packStdout.trim().split('\n').at(-1);

  await execFileAsync('npm', ['init', '-y'], { cwd: tempDir });
  await execFileAsync('npm', ['install', join(process.cwd(), tarball)], {
    cwd: tempDir,
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import('@openstellar/mcp-adapter').then(async (mod) => { if (typeof mod.default !== 'function' || typeof mod.McpAdapterPlugin !== 'function') throw new Error('Plugin exports are not functions'); const result = await mod.default({}, { mcp: {} }); if (!result || typeof result !== 'object') throw new Error('Plugin did not return an object'); console.log('plugin-smoke-ok'); })",
    ],
    { cwd: tempDir },
  );

  process.stdout.write(stdout);
  await rm(new URL(`../${tarball}`, import.meta.url), { force: true });
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
