import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './browser-fixtures';
import { enqueue, records } from './device-fixtures';
import { generation, login, stub } from './fixtures';

for (const language of ['en', 'ar']) {
  test(`refused Retry preserves the body through another refusal and acceptance (${language})`, async ({
    page,
    context,
  }) => {
    const labels = JSON.parse(await readFile(`public/locales/${language}.json`, 'utf8'));
    if (language === 'ar') await page.setViewportSize({ width: 390, height: 844 });
    await stub(context, async () => 'finish');
    const bodies: string[] = [];
    let accept: (() => Promise<void>) | undefined;
    await context.route('**/api/stockEvents{,/**,?*}', async (route) => {
      expect(route.request().method()).toBe('POST');
      bodies.push(route.request().postData() ?? '');
      if (bodies.length < 3) {
        await route.fulfill({
          status: 400,
          json: {
            messageKey: 'stockmanagement.error.event.invalid',
            message: `Refusal ${bodies.length}`,
          },
        });
      } else {
        await new Promise<void>((resolve) => {
          accept = async () => {
            await route.fulfill({
              status: 201,
              json: { id: '11111111-1111-4111-8111-111111111111' },
            });
            resolve();
          };
        });
      }
    });
    await login(page);
    await expect.poll(() => generation(page)).not.toBeNull();
    await context.setOffline(true);
    await enqueue(page, [{ signature: 'Explicit Retry' }]);
    const frozen = (await records(page, 'stockEventQueue'))[0].postBody;
    await context.setOffline(false);
    await expect
      .poll(async () => (await records(page, 'stockEventSyncErrors'))[0]?.message)
      .toBe('Refusal 1');
    await page.evaluate((language) => localStorage.setItem('i18nextLng', language), language);
    await page.goto('./offline-events?tab=errors');
    await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    await expect(page.getByText('Refusal 1', { exact: false })).toBeVisible();
    await context.setOffline(true);
    if (language === 'en') {
      await page.locator('tbody button[aria-haspopup=menu]').click();
      await page
        .getByRole('menuitem', { name: labels['offline-events.retry-refused'], exact: true })
        .click();
    } else {
      await page
        .locator('[data-card-actions]')
        .getByRole('button', { name: labels['offline-events.retry-refused'], exact: true })
        .click();
    }
    await expect(page.getByRole('alertdialog')).not.toBeVisible();
    await expect(
      page.getByText(labels['offline-events.no-errors-title'], { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('div[tabindex="-1"]').filter({
        has: page.getByText(labels['offline-events.no-errors-title'], { exact: true }),
      }),
    ).toBeFocused();
    await page
      .getByRole('tab', {
        name: labels['offline-events.tab-pending'].replace('{count}', '1'),
        exact: true,
      })
      .click();
    await expect
      .poll(async () => (await records(page, 'stockEventQueue'))[0]?.status)
      .toBe('queued');
    await expect(
      page.getByText(labels['transaction-history.type-adjustment'], { exact: true }),
    ).toBeVisible();
    expect(bodies).toEqual([frozen]);
    await page
      .getByRole('tab', {
        name: labels['offline-events.tab-errors'].replace('{count}', '0'),
        exact: true,
      })
      .click();
    await context.setOffline(false);
    await expect
      .poll(async () => (await records(page, 'stockEventSyncErrors'))[0]?.message)
      .toBe('Refusal 2');
    expect(bodies).toEqual([frozen, frozen]);
    await expect(page.getByText('Refusal 2', { exact: false })).toBeVisible();
    if (language === 'en') {
      await page.locator('tbody button[aria-haspopup=menu]').click();
      await page
        .getByRole('menuitem', { name: labels['offline-events.review-event'], exact: true })
        .click();
    } else {
      await page
        .locator('[data-card-actions]')
        .getByRole('button', {
          name: new RegExp(labels['offline-events.review-event-label'].split('{')[0]),
        })
        .click();
    }
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Refusal 2');
    await dialog
      .getByRole('button', { name: labels['offline-events.retry-refused'], exact: true })
      .click();
    await expect(page.getByRole('alertdialog')).not.toBeVisible();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(
      page.getByText(labels['offline-events.no-errors-title'], { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('div[tabindex="-1"]').filter({
        has: page.getByText(labels['offline-events.no-errors-title'], { exact: true }),
      }),
    ).toBeFocused();
    await expect.poll(() => bodies.length).toBe(3);
    await page
      .getByRole('tab', {
        name: labels['offline-events.tab-pending'].replace('{count}', '1'),
        exact: true,
      })
      .click();
    await expect(
      page.getByText(labels['transaction-history.type-adjustment'], { exact: true }),
    ).toBeVisible();
    if (!accept) throw new Error('No retry awaiting acceptance');
    await accept();
    await expect.poll(async () => (await records(page, 'stockEventReceipts')).length).toBe(1);
    expect(bodies).toEqual([frozen, frozen, frozen]);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(
      page.getByText(labels['offline-events.no-events-title'], { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('tab', {
        name: labels['offline-events.tab-synced'].replace('{count}', '1'),
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/offline-events\?tab=synced$/);
    await expect(
      page.getByText(labels['transaction-history.type-adjustment'], { exact: true }),
    ).toBeVisible();
    expect(await records(page, 'stockEventQueue')).toEqual([]);
    expect((await records(page, 'stockEventDrafts'))[0].state).toBe('accepted');
  });
}
