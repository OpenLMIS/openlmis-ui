import { QueryClient } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import {
  podReasonsOptions,
  podReferenceOptions,
  viewSupplierFacilitiesOptions,
} from '@/features/orders/api/queries';
import type { ProofOfDelivery } from '@/features/orders/lib/pod-types';
import { validReasonsOptions } from '@/features/reference-data/api/queries';

it('shares the valid-reasons cache and selects only visible DEBIT reasons', () => {
  const filter = { program: 'p', facilityType: 't' };
  const options = podReasonsOptions(filter);
  expect(options.queryKey).toEqual(validReasonsOptions(filter).queryKey);
  expect(
    options.select?.([
      { hidden: false, reason: { id: 'debit', reasonType: 'DEBIT' } },
      { hidden: true, reason: { id: 'hidden', reasonType: 'DEBIT' } },
      { hidden: false, reason: { id: 'credit', reasonType: 'CREDIT' } },
    ] as never),
  ).toEqual([{ id: 'debit', reasonType: 'DEBIT' }]);
});
it('derives reference lookups from POD identities, lots and ordered products', () => {
  const pod = {
    lineItems: [{ orderable: { id: 'sub', versionNumber: 3 }, lot: { id: 'lot' } }],
    shipment: { order: { orderLineItems: [{ orderable: { id: 'ordered' } }] } },
  } as ProofOfDelivery;
  const options = podReferenceOptions(pod);
  expect(options.products.queryKey).toContainEqual({
    identities: [{ id: 'sub', versionNumber: 3 }],
  });
  expect(options.lots.queryKey).toContainEqual({ ids: ['lot'] });
  expect(options.fulfills.queryKey).toContainEqual({ ids: ['ordered'] });
});
it('accepts explicit ids and canonicalizes the facility cache key', () => {
  const client = new QueryClient();
  const options = viewSupplierFacilitiesOptions(['b', 'a', 'b']);
  client.setQueryData(options.queryKey, []);
  expect(options.queryKey).toEqual(viewSupplierFacilitiesOptions(['a', 'b']).queryKey);
});
