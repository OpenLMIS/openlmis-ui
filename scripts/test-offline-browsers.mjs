import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from '@playwright/test';

const targets = [
  ['chromium', chromium],
  ['chrome', chromium, 'chrome', '/opt/google/chrome/chrome'],
  ['msedge', chromium, 'msedge', '/opt/microsoft/msedge/msedge'],
  ['firefox', firefox],
  ['webkit', webkit],
];
const browsers = [];
for (const [project, engine, channel, executable] of targets) {
  if (executable && !existsSync(executable)) {
    browsers.push({ project, status: 'not-installed' });
    continue;
  }
  try {
    const browser = await engine.launch({ headless: true, channel });
    browsers.push({ project, status: 'available', version: browser.version() });
    await browser.close();
  } catch (error) {
    browsers.push({ project, status: 'blocked', reason: String(error) });
  }
}
console.log(JSON.stringify(browsers, null, 2));
const projects = browsers.filter((browser) => browser.status === 'available');
if (projects.length === 0) throw new Error('No headless browser can run');
await rm('.offline/browser-results.json', { force: true });
const child = spawn(
  'pnpm',
  [
    'exec',
    'playwright',
    'test',
    '--config',
    'playwright.config.ts',
    ...projects.map(({ project }) => `--project=${project}`),
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit' },
);
const exitCode = await new Promise((resolve) => child.once('exit', resolve));
const results = JSON.parse(await readFile('.offline/browser-results.json', 'utf8'));
function collect(suites) {
  return suites.flatMap((suite) => [
    ...suite.specs.flatMap((spec) =>
      spec.tests.map((test) => ({
        project: test.projectName,
        title: spec.title,
        status: test.status,
        outcomes: test.results.map((result) => result.status),
        annotations: test.annotations,
      })),
    ),
    ...collect(suite.suites ?? []),
  ]);
}
await mkdir('.offline', { recursive: true });
await writeFile(
  '.offline/browser-verification.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      basePath: '/v2',
      headless: true,
      availability: browsers.every((browser) => browser.status === 'available')
        ? 'complete'
        : 'partial',
      browsers,
      tests: collect(results.suites),
      stats: results.stats,
    },
    null,
    2,
  ),
);
process.exitCode = exitCode ?? 1;
