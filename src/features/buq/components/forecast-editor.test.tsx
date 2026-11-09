import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { submitBuqForecast } from '@/features/buq/api/api';
import { ForecastForm } from '@/features/buq/components/forecast-editor';
import type { ProductInfo } from '@/features/buq/lib/forecast';
import type { ForecastSearch } from '@/features/buq/lib/search';
import type { BuqForecast, BuqLineItem } from '@/features/buq/lib/types';
import { httpError } from '@/test-utils/http-error';
import { renderPage } from '@/test-utils/render-page';

vi.mock('@/features/buq/api/api', () => ({
  saveBuqForecast: vi.fn(),
  submitBuqForecast: vi.fn(),
  authorizeBuqForecast: vi.fn(),
}));

const NAMES = 'ABCDEFGHIJKL'.split('').map((letter) => `Product ${letter}`);

const line = (index: number, overrides: Partial<BuqLineItem> = {}): BuqLineItem => ({
  id: `l${index}`,
  orderableId: `o${index}`,
  annualAdjustedConsumption: 10,
  verifiedAnnualAdjustedConsumption: null,
  forecastedDemand: null,
  totalCost: null,
  remark: null,
  ...overrides,
});

const FORECAST: BuqForecast = {
  id: 'b1',
  facilityId: 'f1',
  programId: 'g1',
  processingPeriodId: 'p1',
  targetYear: 2018,
  status: 'DRAFT',
  bottomUpQuantificationLineItems: NAMES.map((_, index) =>
    index === 11
      ? line(index, { verifiedAnnualAdjustedConsumption: 5, forecastedDemand: 7 })
      : line(index),
  ),
  fundingDetails: {
    sourcesOfFunds: [
      {
        sourceOfFund: { id: 's1', name: 'User fee' },
        amountUsedInLastFinancialYear: 1,
        projectedFund: 2,
      },
    ],
  },
};

const PRODUCTS: Record<string, ProductInfo> = Object.fromEntries(
  NAMES.map((name, index) => [
    `l${index}`,
    { consumption: 10, code: `C${index}`, name, unit: 'each', price: 1, category: 'Vaccines' },
  ]),
);

beforeEach(() => {
  vi.resetAllMocks();
});

function Harness() {
  const [search, setSearch] = useState<ForecastSearch>({});
  return (
    <ForecastForm
      currency={{
        currencyCode: 'USD',
        currencySymbol: '$',
        currencySymbolSide: 'left',
        currencyDecimalPlaces: 2,
        groupingSize: 3,
        groupingSeparator: ',',
        decimalSeparator: '.',
      }}
      details={{
        region: 'Niassa',
        council: 'Cuamba',
        facilityType: 'Health Center',
        facilityCode: 'N003',
        facilityName: 'Cuamba, Cuamba',
        period: 'July 2017 - June 2018',
      }}
      forecast={FORECAST}
      header={null}
      onCloseDialog={() => setSearch((previous) => ({ ...previous, dialog: undefined }))}
      onDone={vi.fn()}
      onOpenDialog={(dialog) => setSearch((previous) => ({ ...previous, dialog }))}
      onSearchChange={(update) =>
        setSearch((previous) => ({
          ...previous,
          ...(typeof update === 'function' ? update(previous) : update),
        }))
      }
      products={PRODUCTS}
      remarks={[{ id: 'r1', name: 'Outbreaks' }]}
      rights={{ create: true, authorize: false }}
      search={search}
      skipAuthorization={false}
      sources={[]}
    />
  );
}

const renderEditor = async () => {
  renderPage(<Harness />, {
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  });
  await screen.findByText('Product A');
};

const card = (name: string) => {
  const item = screen.getByText(name).closest('li');
  if (!item) throw new Error(`No card for ${name}`);
  return within(item);
};

const verified = (name: string) =>
  card(name).getByRole('textbox', { name: 'buq.forecast.verified' });

it('keeps an edit on page 1 after moving to page 2 and back', async () => {
  const user = userEvent.setup();
  await renderEditor();

  await user.clear(verified('Product A'));
  await user.type(verified('Product A'), '30');
  await user.click(screen.getByRole('button', { name: 'Page 2' }));
  expect(await screen.findByText('Product L')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Page 1' }));

  expect(verified('Product A')).toHaveValue('30');
  expect(card('Product A').getByRole('textbox', { name: 'buq.forecast.forecasted' })).toHaveValue(
    '30',
  );
});

it('refuses Submit for an untouched invalid line on another page and marks that page', async () => {
  const user = userEvent.setup();
  await renderEditor();

  await user.click(screen.getByRole('button', { name: 'buq.forecast.submit' }));

  const dialog = await screen.findByRole('alertdialog');
  expect(dialog).toHaveTextContent('buq.forecast.invalid-title');
  expect(submitBuqForecast).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole('button', { name: 'dialog.close' }));

  expect(
    await screen.findByRole('button', { name: 'Page 2: Contains Invalid Rows' }),
  ).toBeInTheDocument();
  expect(card('Product L').getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
});

it('keeps the draft and shows the server message when Submit is refused', async () => {
  const user = userEvent.setup();
  vi.mocked(submitBuqForecast).mockRejectedValue(
    httpError(400, { messageKey: 'buq.error', message: 'Supervisory node is missing' }),
  );
  await renderEditor();

  await user.click(screen.getByRole('button', { name: 'Page 2' }));
  await screen.findByText('Product L');
  await user.click(card('Product L').getByRole('combobox'));
  await user.click(await screen.findByRole('option', { name: 'Outbreaks' }));
  await user.click(screen.getByRole('button', { name: 'buq.forecast.submit' }));
  const confirm = await screen.findByRole('alertdialog');
  await user.click(within(confirm).getByRole('button', { name: 'buq.forecast.submit' }));

  const failure = await screen.findByRole('alertdialog');
  expect(failure).toHaveTextContent('Supervisory node is missing');
  await waitFor(() => expect(submitBuqForecast).toHaveBeenCalledTimes(1));
  await user.click(within(failure).getByRole('button', { name: 'dialog.close' }));
  expect(card('Product L').getByRole('combobox')).toHaveTextContent('Outbreaks');
});
