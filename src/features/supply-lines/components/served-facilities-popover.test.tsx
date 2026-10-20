import { QueryClient } from '@tanstack/react-query';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import axios from 'axios';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { Suspense } from 'react';
import { initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { supplyLinesPageOptions } from '@/features/supply-lines/api/queries';
import { SupplyLinesTable } from '@/features/supply-lines/components/supply-lines-table';
import type { SupplyLine } from '@/features/supply-lines/lib/types';
import { client } from '@/integrations/axios';
import { renderPage } from '@/tests/render-page';
import en from '../../../../public/locales/en.json';

vi.mock('@/integrations/axios', async () => ({ client: (await import('axios')).default.create() }));

beforeAll(async () => {
  await i18n
    .use(ICU)
    .use(initReactI18next)
    .init({
      lng: 'en',
      keySeparator: false,
      nsSeparator: false,
      resources: { en: { translation: en } },
    });
});
afterEach(() => {
  cleanup();
  client.defaults.adapter = undefined;
});

it('loads full membership only on opening, shares it by node, and keeps failures retryable', async () => {
  // Happy DOM has no layout for the primitive’s safe hover corridor.
  const user = userEvent.setup({
    pointerEventsCheck: PointerEventsCheckLevel.Never,
    skipHover: true,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const requests: URLSearchParams[] = [];
  let fail = true;
  client.defaults.adapter = async (config) => {
    expect(config.url).toBe('/supplyLines');
    const params = config.params as URLSearchParams;
    requests.push(params);
    if (params.get('supervisoryNodeId') === 'other' && fail) {
      throw new axios.AxiosError('Failed', 'ERR_BAD_RESPONSE', config, undefined, {
        data: {},
        status: 500,
        statusText: 'Error',
        headers: {},
        config,
      });
    }
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        content: [
          {
            supervisoryNode: {
              requisitionGroup: {
                memberFacilities:
                  params.get('supervisoryNodeId') === 'empty'
                    ? []
                    : [{ id: 'member', name: 'Served clinic' }],
              },
            },
          },
        ],
      },
    };
  };
  const shallowNode = { id: 'node', code: '17', requisitionGroup: { memberFacilities: [] } };
  const rows: SupplyLine[] = [
    { id: 'one', supervisoryNode: shallowNode, supplyingFacility: { name: 'Supplier A' } },
    { id: 'two', supervisoryNode: shallowNode, supplyingFacility: { name: 'Supplier B' } },
    { id: 'three', supervisoryNode: { id: 'other', code: '18' } },
    { id: 'four', supervisoryNode: { id: 'empty', code: '19' } },
  ];
  queryClient.setQueryDefaults(['supplyLines'], { staleTime: Infinity });
  queryClient.setQueryData(
    supplyLinesPageOptions({ page: 0, size: 10, sort: 'supplyingFacility.name,asc' }).queryKey,
    { content: rows, totalElements: 4, totalPages: 1, number: 0, size: 10 },
  );
  renderPage(
    <Suspense>
      <SupplyLinesTable cards={false} search={{}} columnVisibility={{}} onSearchChange={vi.fn()} />
      <button type="button">Outside</button>
    </Suspense>,
    { queryClient },
  );
  await screen.findByText('Supplier A');
  expect(requests).toHaveLength(0);
  const triggers = screen.getAllByRole('button', { name: /Served facilities for/ });
  await user.hover(triggers[0]);
  expect(await screen.findByText('Served clinic')).toBeVisible();
  expect(requests.map((params) => Object.fromEntries(params))).toEqual([
    {
      supervisoryNodeId: 'node',
      page: '0',
      size: '1',
      expand: 'supervisoryNode.requisitionGroup.memberFacilities',
    },
  ]);
  await user.click(screen.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(triggers[0]).toHaveFocus());
  await user.tab();
  await user.tab();
  expect(await screen.findByText('Served clinic')).toBeVisible();
  expect(requests).toHaveLength(1);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(triggers[1]).toHaveFocus());
  await user.keyboard('{Enter}');
  expect(await screen.findByText('Served clinic')).toBeVisible();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await user.click(triggers[2]);
  const dialog = await screen.findByRole('dialog');
  expect(await within(dialog).findByText(en['supply-lines.membership-error'])).toBeVisible();
  expect(within(dialog).queryByText('No facilities are assigned')).toBeNull();
  fail = false;
  await user.click(within(dialog).getByRole('button', { name: 'Try Again' }));
  expect(await within(dialog).findByText('Served clinic')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Outside' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await user.pointer({ keys: '[TouchA]', target: triggers[3] });
  expect(await screen.findByText('No facilities are assigned')).toBeVisible();
  expect(requests.map((params) => params.get('supervisoryNodeId'))).toEqual([
    'node',
    'other',
    'other',
    'empty',
  ]);
  queryClient.clear();
});
