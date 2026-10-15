import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect, type Page, test } from '@playwright/test';
import { enqueue, records } from './device-fixtures';
import { generation, login, stub } from './fixtures';

const uuid = (number: number) => `11111111-1111-4111-8111-${String(number).padStart(12, '0')}`;
async function ready(page: Page) {
  await login(page);
  await expect.poll(() => generation(page)).not.toBeNull();
  await page.goto('http://127.0.0.1:9165/v2/stock-management/device-events');
  await expect(page.getByRole('heading', { name: 'Device Events', exact: true })).toBeVisible();
}
async function review(page: Page, index = 0) {
  await page.getByRole('button', { name: 'Review Event', exact: true }).nth(index).click();
  await page.getByRole('menuitem', { name: 'Review Event', exact: true }).click();
}
test('reconnect sends two immutable events in sequence, with receipts and Synced only after answers', async ({
  context,
  page,
}) => {
  await stub(context, async () => 'finish');
  const posts: Record<string, unknown>[] = [];
  const releases: (() => Promise<void>)[] = [];
  await context.route('**/api/stockEvents', async (route) => {
    posts.push(route.request().postDataJSON());
    await new Promise<void>((resolve) => {
      releases.push(async () => {
        await route.fulfill({ status: 201, json: uuid(posts.length) });
        resolve();
      });
    });
  });
  await ready(page);
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'First' }, { signature: 'Second' }]);
  await context.setOffline(false);
  await expect.poll(() => posts.length).toBe(1);
  await expect(page.getByRole('note').filter({ hasText: 'Syncing Device Events' })).toBeVisible();
  expect(await records(page, 'stockEventReceipts')).toHaveLength(0);
  await expect(page.getByRole('table')).not.toContainText('Synced');
  expect(posts[0].signature).toBe('First');
  expect(posts[0]).not.toHaveProperty('documentNumber');
  await releases[0]();
  await expect.poll(() => posts.length).toBe(2);
  expect(posts[1].signature).toBe('Second');
  expect(await records(page, 'stockEventReceipts')).toHaveLength(1);
  await releases[1]();
  await expect.poll(async () => (await records(page, 'stockEventReceipts')).length).toBe(2);
  await expect(page.getByRole('table')).toContainText('Synced');
  expect(await records(page, 'stockEventQueue')).toHaveLength(0);
  expect(posts).toHaveLength(2);
});
test('stock-changed refusal retains full signed payload and reason through reload', async ({
  context,
  page,
}) => {
  await stub(context, async () => 'finish');
  let posts = 0;
  await context.route('**/api/stockEvents', async (route) => {
    posts++;
    await route.fulfill({
      status: 400,
      json: {
        messageKey: 'stockmanagement.error.event.debitQuantityExceedSoh',
        message: 'Backdated stock would be negative',
        details: { date: '2026-09-01' },
      },
    });
  });
  await ready(page);
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'Refused Original' }]);
  await context.setOffline(false);
  await expect.poll(async () => (await records(page, 'stockEventSyncErrors')).length).toBe(1);
  await page.reload();
  await expect(page.getByRole('table')).toContainText('Refused');
  await review(page);
  await expect(page.getByRole('dialog')).toContainText('Stock Changed');
  await expect(page.getByRole('dialog')).toContainText('Backdated stock would be negative');
  expect((await records(page, 'stockEventSyncErrors'))[0].event).toMatchObject({
    payload: { signature: 'Refused Original' },
  });
  expect(posts).toBe(1);
});
test('service 401 renews the same user, reads fresh grants, and resends exactly one frozen body', async ({
  context,
  page,
}) => {
  await stub(context, async () => 'finish');
  const posts: string[] = [];
  let grantReads = 0;
  await context.route('**/api/users/download-user/permissionStrings', async (route) => {
    grantReads++;
    await route.fallback();
  });
  await context.route('**/api/oauth/token{,?*}', (route) =>
    route.fulfill({
      json: {
        referenceDataUserId: 'download-user',
        username: 'download-user',
        access_token: `token-${Date.now()}`,
        expires_in: 1800,
      },
    }),
  );
  await context.route('**/api/stockEvents', (route) => {
    posts.push(route.request().postData() ?? '');
    return route.fulfill(
      posts.length === 1
        ? { status: 401, json: { error: 'invalid_token' } }
        : { status: 201, json: uuid(1) },
    );
  });
  await ready(page);
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'Renewal' }]);
  await context.setOffline(false);
  await expect.poll(() => posts.length).toBe(1);
  await expect(
    page.getByRole('note', { includeHidden: true }).filter({ hasText: 'Sign In To Sync' }),
  ).toBeVisible();
  const readsBefore = grantReads;
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Password', { exact: true }).fill('fixture-password');
  await dialog.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect.poll(async () => (await records(page, 'stockEventReceipts')).length).toBe(1);
  expect(posts).toHaveLength(2);
  expect(posts[1]).toBe(posts[0]);
  expect(grantReads).toBeGreaterThan(readsBefore);
});
test('interrupted upload survives restart, barriers are scoped, and both explicit choices preserve attempts', async () => {
  const directory = await mkdtemp(resolve('.offline/profile-stage-7-'));
  let context = await chromium.launchPersistentContext(directory, {
    headless: true,
    serviceWorkers: 'allow',
  });
  const posts: string[] = [];
  const attach = async () => {
    await stub(context, async () => 'finish');
    await context.route('**/api/stockEvents', async (route) => {
      posts.push(route.request().postDataJSON().signature);
      if (posts.length === 1) await new Promise<void>((resolve) => context.once('close', resolve));
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
    context = await chromium.launchPersistentContext(directory, {
      headless: true,
      serviceWorkers: 'allow',
    });
    await attach();
    page = context.pages()[0];
    await page.goto('http://127.0.0.1:9165/v2/stock-management/device-events');
    await expect
      .poll(async () => (await records(page, 'stockEventQueue'))[0]?.status)
      .toBe('uncertain');
    await expect(page.getByRole('table')).toContainText('Uncertain');
    expect(posts).toEqual(['Unknown']);
    await context.setOffline(true);
    await enqueue(page, [{ signature: 'Other Program', programId: 'never' }]);
    await context.setOffline(false);
    await expect.poll(async () => (await records(page, 'stockEventReceipts')).length).toBe(1);
    expect(posts).toEqual(['Unknown', 'Other Program']);
    await review(page);
    await expect(page.getByRole('dialog')).toContainText(
      'We could not confirm whether this event was recorded.',
    );
    await expect(
      page.getByRole('link', { name: 'Transaction History', exact: true }),
    ).toHaveAttribute('href', /facilityId=home/);
    await page.getByRole('button', { name: 'Send Again', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    expect(posts).toHaveLength(2);
    await page.getByRole('button', { name: 'It Was Recorded', exact: true }).click();
    await expect.poll(async () => (await records(page, 'stockEventReceipts')).length).toBe(3);
    expect(await records(page, 'stockEventQueue')).toHaveLength(0);
    expect(posts).toEqual(['Unknown', 'Other Program', 'Blocked']);
    await expect(page.getByRole('table')).toContainText('Marked As Recorded By You');
    await context.setOffline(true);
    await enqueue(page, [{ signature: 'Retry Unknown' }]);
    await context.route('**/api/stockEvents', async (route) => {
      posts.push(route.request().postDataJSON().signature);
      await route.abort('failed');
    });
    await context.setOffline(false);
    await expect
      .poll(async () =>
        (await records(page, 'stockEventQueue')).some((row) => row.status === 'uncertain'),
      )
      .toBe(true);
    await context.unroute('**/api/stockEvents');
    await context.route('**/api/stockEvents', async (route) => {
      posts.push(route.request().postDataJSON().signature);
      await route.fulfill({ status: 201, json: uuid(posts.length) });
    });
    await review(page, 3);
    await page.getByRole('button', { name: 'Send Again', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Send Again', exact: true })
      .dblclick();
    await expect.poll(async () => (await records(page, 'stockEventReceipts')).length).toBe(4);
    expect(await records(page, 'stockEventQueue')).toHaveLength(0);
    expect(posts).toHaveLength(5);
    expect(posts.slice(3)).toEqual(['Retry Unknown', 'Retry Unknown']);
    const drafts = await records(page, 'stockEventDrafts');
    expect(
      drafts.some(
        (draft) =>
          Array.isArray(draft.history) && draft.history.some((item) => item.choice === 'resend'),
      ),
    ).toBe(true);
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test('two tabs reconnecting have one uploader and never overlap POSTs', async ({
  context,
  page,
}) => {
  await stub(context, async () => 'finish');
  let active = 0;
  let maximum = 0;
  let posts = 0;
  let release!: () => Promise<void>;
  await context.route('**/api/stockEvents', async (route) => {
    active++;
    maximum = Math.max(maximum, active);
    posts++;
    if (posts === 1)
      await new Promise<void>((resolve) => {
        release = async () => {
          await route.fulfill({ status: 201, json: uuid(1) });
          active--;
          resolve();
        };
      });
    else {
      await route.fulfill({ status: 201, json: uuid(2) });
      active--;
    }
  });
  await ready(page);
  const other = await context.newPage();
  await other.goto('/v2/stock-management/device-events');
  await expect(other.getByRole('heading', { name: 'Device Events', exact: true })).toBeVisible();
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'First' }, { signature: 'Second' }]);
  await context.setOffline(false);
  await expect.poll(() => posts).toBe(1);
  expect(maximum).toBe(1);
  await release();
  await expect.poll(async () => (await records(page, 'stockEventReceipts')).length).toBe(2);
  expect(posts).toBe(2);
  expect(maximum).toBe(1);
});

test('recovery without viewing rights offers both choices without protected history reads', async ({
  context,
  page,
}) => {
  await stub(context, async () => 'finish');
  let posts = 0;
  let historyReads = 0;
  await context.route('**/api/users/download-user/permissionStrings', (route) =>
    route.fulfill({ json: ['STOCK_ADJUST|home|program'] }),
  );
  await context.route('**/api/stockEvents{,/**,?*}', async (route) => {
    if (route.request().method() === 'POST') posts++;
    else historyReads++;
    await route.abort('failed');
  });
  await login(page);
  await expect(page).toHaveURL(/\/stock-management\/adjustments$/);
  await page.goto('http://127.0.0.1:9165/v2/stock-management/device-events');
  await expect(page.getByRole('heading', { name: 'Device Events', exact: true })).toBeVisible();
  await expect(page.getByText('No Device Events', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'No View' }]);
  await context.setOffline(false);
  await expect
    .poll(async () => (await records(page, 'stockEventQueue'))[0]?.status)
    .toBe('uncertain');
  await review(page);
  await expect(page.getByRole('dialog')).toContainText(
    'You do not have access to Stock Cards or Transaction History, so you cannot check this event yourself. Ask someone with access to check before choosing.',
  );
  await expect(page.getByRole('dialog').getByRole('link')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'It Was Recorded', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Send Again', exact: true })).toBeEnabled();
  expect(posts).toBe(1);
  expect(historyReads).toBe(0);
});

test('online refusal stays in the editor, shows the server reason, and reopens a corrected copy', async ({
  context,
  page,
}) => {
  await stub(context, async () => 'finish');
  let posts = 0;
  await context.route('**/api/stockEvents', async (route) => {
    posts++;
    await route.fulfill({
      status: 400,
      json: {
        messageKey: 'stockmanagement.error.event.debitQuantityExceedSoh',
        message: 'Backdated stock would be negative',
      },
    });
  });
  await ready(page);
  await page.goto('http://127.0.0.1:9165/v2/stock-management/adjustments/program');
  await page.getByRole('combobox', { name: 'Product', exact: true }).click();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('textbox', { name: /^Quantity,/ }).fill('1');
  await page.getByRole('combobox', { name: /^Reason,/ }).click();
  await page.getByRole('option', { name: 'Damaged', exact: true }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Signature', exact: true }).fill('Refused Online');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  const failure = page.getByRole('alertdialog');
  await expect(failure).toContainText('Backdated stock would be negative');
  await expect(
    failure.getByRole('button', { name: 'Review Device Events', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/adjustments\/program$/);
  await expect(page.getByRole('textbox', { name: /^Quantity,/, includeHidden: true })).toHaveValue(
    '1',
  );
  await expect(
    page.getByRole('button', { name: 'Submit', exact: true, includeHidden: true }),
  ).toBeDisabled();
  await expect(page.getByText('Saved On This Device', { exact: true })).toHaveCount(0);
  await failure.getByRole('button', { name: 'Copy For Correction', exact: true }).click();
  const details = page.getByRole('dialog');
  await expect(details).toContainText('Refused Online');
  await expect(details).toContainText('Type');
  await details.getByRole('button', { name: 'Copy For Correction', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Copy For Correction', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: /^Quantity,/ })).toHaveValue('1');
  await expect
    .poll(
      async () =>
        (await records(page, 'stockEventDrafts')).filter((row) => row.state === 'editing').length,
    )
    .toBe(1);
  expect(
    (await records(page, 'stockEventDrafts')).filter((row) => row.state === 'refused'),
  ).toHaveLength(1);
  expect(await records(page, 'stockEventQueue')).toHaveLength(0);
  expect(await records(page, 'stockEventReceipts')).toHaveLength(0);
  expect(posts).toBe(1);
});
