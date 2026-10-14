import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin = 'https://test.openlmis.org';
const output = new URL('../.offline/measurement.json', import.meta.url);
const env = {};
for (const file of ['.env.example', '.env']) {
  const contents = await readFile(new URL(`../${file}`, import.meta.url), 'utf8').catch(() => '');
  for (const line of contents.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}
const clientId = process.env.VITE_AUTH_SERVER_CLIENT_ID || env.VITE_AUTH_SERVER_CLIENT_ID;
const clientSecret =
  process.env.VITE_AUTH_SERVER_CLIENT_SECRET || env.VITE_AUTH_SERVER_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error('OAuth client credentials are required');

function allowRequest(method, url) {
  const parsed = new URL(url);
  return (
    parsed.origin === origin &&
    (method === 'GET' ||
      (method === 'POST' &&
        ['/api/oauth/token', '/api/orderables/search'].includes(parsed.pathname)))
  );
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'block' });
const requests = [];
const datasets = [];
let token;
let forbiddenRequest;
const started = performance.now();
try {
  await context.route('**/*', async (route) => {
    const request = route.request();
    if (!allowRequest(request.method(), request.url())) {
      await route.abort('blockedbyclient');
      forbiddenRequest = `Forbidden request: ${request.method()} ${request.url()}`;
      return;
    }
    if (request.isNavigationRequest())
      await route.fulfill({ body: '<html></html>', contentType: 'text/html' });
    else await route.continue();
  });
  const page = await context.newPage();
  await page.goto(origin);
  if (forbiddenRequest) throw new Error(forbiddenRequest);
  async function request(scope, dataset, path, params = {}, body) {
    const url = new URL(`/api${path}`, origin);
    for (const [key, value] of Object.entries(params)) {
      for (const item of Array.isArray(value) ? value : [value])
        url.searchParams.append(key, String(item));
    }
    const method = body === undefined ? 'GET' : 'POST';
    if (!allowRequest(method, url.href)) throw new Error(`Forbidden request: ${method} ${url}`);
    const headers =
      path === '/oauth/token'
        ? {
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        : { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const requestStartedMs = performance.now() - started;
    const result = await page.evaluate(
      async ({ url, method, headers, body }) => {
        const start = performance.now();
        try {
          const response = await fetch(url, {
            method,
            headers,
            body,
            signal: AbortSignal.timeout(60_000),
            redirect: 'error',
          });
          const text = await response.text();
          return {
            status: response.status,
            text,
            ms: performance.now() - start,
            transferBytes: response.headers.get('content-length'),
          };
        } catch (error) {
          return { status: 0, text: '', ms: performance.now() - start, error: String(error) };
        }
      },
      {
        url: url.href,
        method,
        headers,
        body:
          body === undefined
            ? undefined
            : path === '/oauth/token'
              ? new URLSearchParams(body).toString()
              : JSON.stringify(body),
      },
    );
    if (forbiddenRequest) throw new Error(forbiddenRequest);
    const entry = {
      scope,
      dataset,
      startedMs: requestStartedMs,
      endedMs: performance.now() - started,
      method,
      path: url.pathname + url.search,
      status: result.status,
      ms: result.ms,
      transferBytes: result.transferBytes ? Number(result.transferBytes) : null,
      failure: result.error || (result.status >= 400 ? result.text : null),
    };
    requests.push(entry);
    console.log(
      `${scope} ${dataset}: ${method} ${entry.path} ${result.status} ${(result.ms / 1000).toFixed(3)}s`,
    );
    if (entry.failure) throw new Error(entry.failure);
    return JSON.parse(result.text);
  }
  const unique = (rows, key = (row) => (typeof row === 'string' ? row : row.id)) => [
    ...new Map(rows.map((row) => [key(row), row])).values(),
  ];
  function record(scope, dataset, rows, key) {
    const records = unique(rows, key);
    datasets.push({
      scope,
      dataset,
      records,
      recordCount: records.length,
      bytes: Buffer.byteLength(JSON.stringify(records)),
    });
    return records;
  }
  async function lookup(scope, dataset, path, ids, identities = false) {
    const found = [];
    const distinct = identities
      ? unique(ids, (item) => `${item.id}|${item.versionNumber}`)
      : [...new Set(ids)];
    const batches = Array.from({ length: Math.ceil(distinct.length / 100) }, (_, i) =>
      distinct.slice(i * 100, i * 100 + 100),
    );
    for (let offset = 0; offset < batches.length; offset += 8) {
      await Promise.all(
        batches.slice(offset, offset + 8).map(async (batch) => {
          for (let page = 0; ; page += 1) {
            const data = await request(
              scope,
              dataset,
              path,
              identities ? {} : { id: batch, page, size: 100 },
              identities ? { identities: batch, page, size: 100 } : undefined,
            );
            found.push(...data.content);
            if (page + 1 >= data.totalPages) break;
          }
        }),
      );
    }
    return found;
  }
  const login = await request(
    'shared',
    'token',
    '/oauth/token',
    { grant_type: 'password' },
    { username: 'administrator', password: process.env.OFFLINE_MEASUREMENT_PASSWORD || 'password' },
  );
  token = login.access_token;
  const id = login.referenceDataUserId;
  const permissions = record(
    'shared',
    'permissions',
    await request('shared', 'permissions', `/users/${id}/permissionStrings`),
  );
  const user = await request('shared', 'context', `/users/${id}`);
  const programs = await request('shared', 'context', `/users/${id}/programs`);
  const home = await request('shared', 'context', `/facilities/${user.homeFacilityId}`);
  if (home.name !== 'Comfort Health Clinic') throw new Error(`Unexpected home: ${home.name}`);
  record('shared', 'context', [user, home, ...programs]);
  for (const name of ['Family Planning', 'Essential Meds']) {
    const program = programs.find((item) => item.name === name);
    if (!program) throw new Error(`Missing program: ${name}`);
    for (const right of ['STOCK_ADJUST', 'STOCK_CARDS_VIEW']) {
      if (!permissions.includes(`${right}|${home.id}|${program.id}`))
        throw new Error(`Missing ${right} for ${name}`);
    }
    if (!home.supportedPrograms.some((item) => item.id === program.id && item.supportActive))
      throw new Error(`Unsupported program: ${name}`);
    const summaries = [];
    for (let page = 0; ; page += 1) {
      const data = await request(name, 'summaries', '/v2/stockCardSummaries', {
        facilityId: home.id,
        programId: program.id,
        nonEmptyOnly: true,
        ...(page > 0 ? { page } : {}),
      });
      summaries.push(...data.content);
      if (page + 1 >= data.totalPages) break;
    }
    record(
      name,
      'summaries',
      summaries,
      (row) => `${row.orderable.id}|${row.orderable.versionNumber ?? ''}`,
    );
    const cards = record(
      name,
      'cards (derived)',
      summaries.flatMap((row) => row.canFulfillForMe),
      (row) => row.stockCard.id,
    );
    const identities = summaries.flatMap((row) =>
      row.orderable.versionNumber === undefined
        ? []
        : [{ id: row.orderable.id, versionNumber: row.orderable.versionNumber }],
    );
    const fetchedProducts = await lookup(
      name,
      'products',
      '/orderables',
      cards.map((row) => row.orderable.id),
    );
    const products = unique(
      fetchedProducts.toSorted(
        (a, b) => (a.meta?.versionNumber ?? 0) - (b.meta?.versionNumber ?? 0),
      ),
    );
    const versions = await lookup(name, 'versions', '/orderables/search', identities, true);
    for (const identity of identities) {
      if (
        !versions.some(
          (row) => row.id === identity.id && row.meta?.versionNumber === identity.versionNumber,
        )
      )
        throw new Error(`Unresolved version ${JSON.stringify(identity)}`);
    }
    const allProducts = record(
      name,
      'products',
      [...products, ...versions],
      (row) => `${row.id}|${row.meta?.versionNumber ?? 0}`,
    );
    const lots = record(
      name,
      'lots',
      await lookup(
        name,
        'lots',
        '/lots',
        cards.flatMap((row) => (row.lot ? [row.lot.id] : [])),
      ),
    );
    for (const card of cards) {
      if (
        !allProducts.some((row) => row.id === card.orderable.id) ||
        (card.lot && !lots.some((row) => row.id === card.lot.id))
      )
        throw new Error('Unresolved stock card');
    }
    record(
      name,
      'reasons',
      await request(name, 'reasons', '/validReasons', {
        program: program.id,
        facilityType: home.type.id,
      }),
    );
    const tradeIds = allProducts.flatMap((row) =>
      row.identifiers?.tradeItem ? [row.identifiers.tradeItem] : [],
    );
    const trades = await lookup(name, 'trade items', '/tradeItems', tradeIds);
    for (const tradeId of tradeIds)
      if (!trades.some((row) => row.id.toLowerCase() === tradeId.toLowerCase()))
        throw new Error(`Missing trade item ${tradeId}`);
    record(name, 'trade items', trades);
  }
  const combined = [];
  for (const dataset of [...new Set(datasets.map((item) => item.dataset))]) {
    const rows = datasets
      .filter((item) => item.dataset === dataset)
      .flatMap((item) => item.records);
    const key =
      dataset === 'products'
        ? (row) => `${row.id}|${row.meta?.versionNumber ?? 0}`
        : dataset === 'summaries'
          ? (row) => `${row.orderable.id}|${row.orderable.versionNumber ?? ''}`
          : dataset === 'cards (derived)'
            ? (row) => row.stockCard.id
            : undefined;
    combined.push({
      dataset,
      recordCount: unique(rows, key).length,
      bytes: Buffer.byteLength(JSON.stringify(unique(rows, key))),
    });
  }
  await mkdir(new URL('../.offline/', import.meta.url), { recursive: true });
  await writeFile(
    output,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browser: browser.version(),
        wallMs: performance.now() - started,
        fixture: {
          userId: id,
          facilityId: home.id,
          programs: programs
            .filter((row) => ['Family Planning', 'Essential Meds'].includes(row.name))
            .map(({ id, name }) => ({ id, name })),
        },
        requests,
        datasets,
        combined,
        totals: ['Family Planning', 'Essential Meds', 'combined'].map((scope) => {
          const scoped = requests.filter(
            (row) => scope === 'combined' || row.scope === scope || row.scope === 'shared',
          );
          const selected =
            scope === 'combined'
              ? combined
              : datasets.filter((row) => row.scope === scope || row.scope === 'shared');
          return {
            scope,
            requestCount: scoped.length,
            bytes: selected
              .filter((row) => row.dataset !== 'cards (derived)')
              .reduce((sum, row) => sum + row.bytes, 0),
            requestMs: scoped.reduce((sum, row) => sum + row.ms, 0),
            slowestMs: Math.max(...scoped.map((row) => row.ms)),
            failures: scoped.filter((row) => row.failure).length,
          };
        }),
      },
      null,
      2,
    ),
  );
  console.log(`Report: ${output.pathname}`);
} catch (error) {
  await mkdir(new URL('../.offline/', import.meta.url), { recursive: true });
  await writeFile(
    new URL('../.offline/measurement-failure.json', import.meta.url),
    JSON.stringify({ requests, forbiddenRequest, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
