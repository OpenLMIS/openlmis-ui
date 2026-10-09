import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import { InventoryScan } from '@/features/stock-events/components/inventory-scan';
import { addedInventoryLine } from '@/features/stock-events/lib/physical-inventory-products';
import { useBarcodeScan } from '@/hooks/use-barcode-scan';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('@/hooks/use-barcode-scan', () => ({ useBarcodeScan: vi.fn(() => ({ status: 'ready' })) }));
const stock = {
  orderable: {
    id: 'p',
    productCode: 'P',
    fullProductName: 'Product',
    description: null,
    netContent: 10,
    identifiers: { tradeItem: 't' },
  },
  lot: null,
  stockOnHand: null,
};
it('counts against the latest edit when a GTIN lookup finishes', async () => {
  const lookup = Promise.withResolvers<{ id: string }>();
  const client = new QueryClient();
  vi.spyOn(client, 'fetchQuery').mockImplementation(() => lookup.promise as never);
  const onCount = vi.fn();
  const tree = (count: string) => (
    <QueryClientProvider client={client}>
      <InventoryScan
        eligible={[stock]}
        lines={[addedInventoryLine(stock, quantityValue(count))]}
        canManageLots={false}
        paused={false}
        onCount={onCount}
      />
    </QueryClientProvider>
  );
  const view = render(tree('1'));
  const scan = vi.mocked(useBarcodeScan).mock.calls.at(-1)?.[0].onScan;
  if (!scan) throw new Error('no scan');
  const result = scan(
    { ok: true, gtin: 'g', warnings: [], unparsed: {} },
    new AbortController().signal,
  );
  view.rerender(tree('7'));
  await act(async () => {
    lookup.resolve({ id: 't' });
    await result;
  });
  expect(onCount).toHaveBeenCalledWith(
    expect.objectContaining({ quantity: { doses: '17', packs: '1', remainder: '7' } }),
  );
});
it('counts two queued scans before React renders the first count', async () => {
  const client = new QueryClient();
  vi.spyOn(client, 'fetchQuery').mockResolvedValue({ id: 't' } as never);
  let current = [addedInventoryLine(stock, quantityValue('0'))];
  const onCount = vi.fn((line) => {
    current = [line];
  });
  render(
    <QueryClientProvider client={client}>
      <InventoryScan
        eligible={[stock]}
        lines={current}
        getLines={() => current}
        canManageLots={false}
        paused={false}
        onCount={onCount}
      />
    </QueryClientProvider>,
  );
  const scan = vi.mocked(useBarcodeScan).mock.calls.at(-1)?.[0].onScan;
  if (!scan) throw new Error('no scan');
  await act(async () => {
    for (let i = 0; i < 2; i++)
      await scan({ ok: true, gtin: 'g', warnings: [], unparsed: {} }, new AbortController().signal);
  });
  expect(current[0].quantity.doses).toBe('20');
});
