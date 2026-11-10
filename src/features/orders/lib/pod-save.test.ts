import { expect, it } from 'vitest';
import { buildPodBody, mergeSavedPod } from '@/features/orders/lib/pod-save';
import type { ProofOfDelivery } from '@/features/orders/lib/pod-types';

const pod = {
  id: 'pod',
  status: 'INITIATED',
  receivedBy: null,
  deliveredBy: null,
  receivedDate: null,
  shipment: {
    id: 'shipment',
    order: { id: 'order' },
    lineItems: [{ orderable: { id: 'p' }, lot: null, quantityShipped: 8 }],
  },
  lineItems: [
    {
      id: 'line',
      orderable: { id: 'p', versionNumber: 1 },
      lot: null,
      quantityAccepted: null,
      quantityRejected: 0,
      vvmStatus: null,
      useVvm: false,
      rejectionReasonId: null,
      notes: null,
    },
  ],
} as ProofOfDelivery;
it('builds exactly the writable DTO, keeping incomplete footer and null blank accepted', () => {
  expect(
    buildPodBody(
      pod,
      {
        lines: { line: { accepted: '', reason: '', vvm: '', notes: '' } },
        receivedBy: '',
        deliveredBy: '',
        receivedDate: '',
      },
      'INITIATED',
    ),
  ).toEqual({
    shipment: { id: 'shipment' },
    status: 'INITIATED',
    receivedBy: null,
    deliveredBy: null,
    receivedDate: null,
    lineItems: [
      {
        id: 'line',
        quantityAccepted: null,
        quantityRejected: 0,
        vvmStatus: null,
        rejectionReasonId: null,
        notes: '',
      },
    ],
  });
  expect(() =>
    buildPodBody(
      pod,
      {
        lines: { line: { accepted: '1.5', reason: '', vvm: '', notes: '' } },
        receivedBy: '',
        deliveredBy: '',
        receivedDate: '',
      },
      'INITIATED',
    ),
  ).toThrow();
});
it('keeps missing-shipment lines unchanged and merges saves without losing expansion or untouched lines', () => {
  const orphan = { ...pod, shipment: { ...pod.shipment, lineItems: [] } };
  expect(
    buildPodBody(
      orphan,
      {
        lines: { line: { accepted: '9', reason: 'new', vvm: '', notes: 'new' } },
        receivedBy: 'r',
        deliveredBy: 'd',
        receivedDate: '2026-11-10',
      },
      'INITIATED',
    ).lineItems[0].quantityAccepted,
  ).toBeNull();
  const response = {
    ...pod,
    status: 'CONFIRMED' as const,
    shipment: { id: 'shipment' },
    lineItems: [{ ...pod.lineItems[0], quantityAccepted: 8 }],
  };
  const merged = mergeSavedPod(pod, response);
  expect(merged.shipment).toBe(pod.shipment);
  expect(merged.lineItems[0].quantityAccepted).toBe(8);
  expect(merged.status).toBe('CONFIRMED');
});

it('serializes accepted packs and returned packs while preserving read-only orphan values', () => {
  const orphan = {
    ...pod.lineItems[0],
    id: 'orphan',
    orderable: { id: 'other', versionNumber: 1 },
    quantityAccepted: 2,
    quantityRejected: 1,
    rejectionReasonId: 'original',
    notes: 'kept',
  };
  const body = buildPodBody(
    { ...pod, lineItems: [...pod.lineItems, orphan] },
    {
      lines: {
        line: { accepted: '٥', reason: 'damage', vvm: 'STAGE_2', notes: 'broken' },
        orphan: { accepted: '', reason: '', vvm: '', notes: '' },
      },
      receivedBy: 'Receiver',
      deliveredBy: 'Driver',
      receivedDate: '2026-11-10',
    },
    'CONFIRMED',
  );
  expect(body.lineItems).toEqual([
    {
      id: 'line',
      quantityAccepted: 5,
      quantityRejected: 3,
      rejectionReasonId: 'damage',
      vvmStatus: 'STAGE_2',
      notes: 'broken',
    },
    {
      id: 'orphan',
      quantityAccepted: 2,
      quantityRejected: 1,
      rejectionReasonId: 'original',
      vvmStatus: null,
      notes: 'kept',
    },
  ]);
  expect(body).toMatchObject({
    status: 'CONFIRMED',
    receivedBy: 'Receiver',
    deliveredBy: 'Driver',
    receivedDate: '2026-11-10',
  });
  const merged = mergeSavedPod(
    { ...pod, lineItems: [...pod.lineItems, orphan] },
    {
      ...pod,
      shipment: { id: 'shipment' },
      lineItems: [{ ...pod.lineItems[0], quantityAccepted: 5 }],
    },
  );
  expect(merged.lineItems[1]).toEqual(orphan);
});
