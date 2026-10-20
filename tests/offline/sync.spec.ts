import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test } from './browser-fixtures';
import { enqueue, records } from './device-fixtures';
import { generation, login, stub } from './fixtures';

const catalog = JSON.parse(await readFile('public/locales/en.json', 'utf8'));

const uuid = (number: number) => `11111111-1111-4111-8111-${String(number).padStart(12, '0')}`;
async function ready(page: Page) {
  await login(page);
  await expect.poll(() => generation(page)).not.toBeNull();
  await page.goto('./offline-events');
  await expect(
    page.getByRole('heading', { name: catalog['device-events.title'], exact: true }),
  ).toBeVisible();
}

test('interrupted upload becomes uncertain after restart and is never automatically resent', async ({
  persistentContext,
}) => {
  const directory = await mkdtemp(join(tmpdir(), 'openlmis-offline-7-'));
  let context = await persistentContext(directory);
  const posts: string[] = [];
  const attach = async () => {
    await stub(context, async () => 'finish');
    await context.route('**/api/stockEvents', async (route) => {
      posts.push(route.request().postDataJSON().signature);
      if (posts.length === 1)
        await new Promise<void>((resolve) => context.once('close', () => resolve()));
      else await route.fulfill({ status: 201, json: uuid(posts.length) });
    });
  };
  try {
    await attach();
    let page = context.pages()[0];
    await ready(page);
    await context.setOffline(true);
    await enqueue(page, [{ signature: 'Unknown' }, { signature: 'Blocked' }]);
    await context.setOffline(false);
    await expect
      .poll(async () => (await records(page, 'stockEventQueue'))[0]?.status)
      .toBe('sending');
    expect(posts).toEqual(['Unknown']);
    await context.close();
    context = await persistentContext(directory);
    await attach();
    page = context.pages()[0];
    await page.goto('./offline-events');
    await expect
      .poll(async () => (await records(page, 'stockEventQueue'))[0]?.status)
      .toBe('uncertain');
    await expect(page.getByRole('table')).toContainText(catalog['device-events.status-uncertain']);
    expect(posts).toEqual(['Unknown']);
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test('two tabs reconnect in sequence with one uploader and receipts only after answers', async ({
  context,
  page,
}) => {
  await stub(context, async () => 'finish');
  const posts: Record<string, unknown>[] = [];
  const releases: (() => Promise<void>)[] = [];
  let active = 0;
  let maximum = 0;
  await context.route('**/api/stockEvents', async (route) => {
    active++;
    maximum = Math.max(maximum, active);
    posts.push(route.request().postDataJSON());
    const id = uuid(posts.length);
    await new Promise<void>((resolve) => {
      releases.push(async () => {
        await route.fulfill({ status: 201, json: id });
        active--;
        resolve();
      });
    });
  });
  await ready(page);
  const other = await context.newPage();
  await other.goto('./offline-events');
  await expect(
    other.getByRole('heading', { name: catalog['device-events.title'], exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'First' }, { signature: 'Second' }]);
  await context.setOffline(false);
  await expect.poll(() => posts.length).toBe(1);
  await expect(
    page.getByRole('note').filter({ hasText: catalog['device-events.syncing'] }),
  ).toBeVisible();
  expect(posts[0].signature).toBe('First');
  expect(posts[0]).not.toHaveProperty('documentNumber');
  expect(await records(page, 'stockEventReceipts')).toHaveLength(0);
  await expect(page.getByRole('table')).not.toContainText(catalog['device-events.status-accepted']);
  expect(maximum).toBe(1);
  await releases[0]();
  await expect.poll(() => posts.length).toBe(2);
  expect(posts[1].signature).toBe('Second');
  expect(posts[1]).not.toHaveProperty('documentNumber');
  expect(await records(page, 'stockEventReceipts')).toHaveLength(1);
  await releases[1]();
  await expect.poll(async () => (await records(page, 'stockEventReceipts')).length).toBe(2);
  await expect(page.getByRole('table')).toContainText(catalog['device-events.status-accepted']);
  await expect
    .poll(async () =>
      (
        await Promise.all(
          [page, other].map((tab) =>
            tab
              .getByRole('note')
              .filter({ hasText: catalog['device-events.sync-complete'] })
              .isVisible(),
          ),
        )
      ).some(Boolean),
    )
    .toBe(true);
  expect(await records(page, 'stockEventQueue')).toHaveLength(0);
  expect(posts).toHaveLength(2);
  expect(maximum).toBe(1);
});

test('closing the uploading tab leaves uncertainty in the surviving tab without a second POST', async ({
  context,
  page,
}) => {
  await stub(context, async () => 'finish');
  let posts = 0;
  let owner: Page | undefined;
  await context.route('**/api/stockEvents', async (route) => {
    posts++;
    owner = route.request().frame().page();
    await new Promise<void>((resolve) => owner?.once('close', () => resolve()));
  });
  await ready(page);
  const other = await context.newPage();
  await other.goto('./offline-events');
  await expect(
    other.getByRole('heading', { name: catalog['device-events.title'], exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'Interrupted Owner' }, { signature: 'Held Behind Owner' }]);
  await context.setOffline(false);
  await expect.poll(() => posts).toBe(1);
  if (!owner) throw new Error('No upload owner');
  const survivor = owner === page ? other : page;
  await owner.close();
  await expect
    .poll(async () => (await records(survivor, 'stockEventQueue'))[0]?.status)
    .toBe('uncertain');
  await expect(survivor.getByRole('table')).toContainText(
    catalog['device-events.status-uncertain'],
  );
  expect(await records(survivor, 'stockEventQueue')).toHaveLength(2);
  expect(posts).toBe(1);
});
