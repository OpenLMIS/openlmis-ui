import { expect, it } from 'vitest';
import { column, line, record } from '@/features/requisitions/lib/fixtures/builders';
import { transformRequisition } from '@/features/requisitions/lib/transform';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

it('cuts identities, nulls hidden/calculated cells and removes client data without mutating the record', () => {
  const input = {
    ...record(),
    id: 'r',
    facility: { id: 'f', name: 'Facility' },
    processingPeriod: { id: 'period' },
    program: { id: 'p', name: 'Program' },
    template: {
      columnsMap: {
        stockOnHand: column('stockOnHand'),
        requestedQuantityExplanation: column('requestedQuantityExplanation', 1, {
          isDisplayed: false,
        }),
        numberOfPatientsOnTreatmentNextMonth: column('numberOfPatientsOnTreatmentNextMonth'),
      },
    },
    requisitionLineItems: [
      {
        ...line({
          stockOnHand: 5,
          requestedQuantity: 9,
          requestedQuantityExplanation: 'hidden',
          numberOfPatientsOnTreatmentNextMonth: 3,
        }),
        orderable: { id: 'p', versionNumber: 2, fullProductName: 'Product' },
        patientQuantitiesNotAvailable: true,
        $errors: {},
        useQuantityUnit: 'packs',
      },
    ],
    availableProducts: [],
    stockAdjustmentReasons: [],
    eTag: 'old',
    useQuantityUnit: 'packs',
    draftStatusMessage: 'Comment',
    modifiedDate: '2026-10-28',
    datePhysicalStockCountCompleted: '2026-10-27',
    extraData: { originalRequisition: 'original' },
    patientsData: '{}',
  };
  const body = transformRequisition(input as RequisitionRecord);
  expect(body).toMatchObject({
    program: { id: 'p' },
    facility: { id: 'f' },
    draftStatusMessage: 'Comment',
    modifiedDate: '2026-10-28',
    datePhysicalStockCountCompleted: '2026-10-27',
    extraData: input.extraData,
    patientsData: '{}',
  });
  expect(body.requisitionLineItems[0]).toEqual({
    ...line(),
    orderable: { id: 'p', versionNumber: 2 },
    stockOnHand: null,
    requestedQuantity: 9,
    requestedQuantityExplanation: null,
    numberOfPatientsOnTreatmentNextMonth: 3,
  });
  for (const key of [
    'template',
    'availableProducts',
    'stockAdjustmentReasons',
    'eTag',
    'useQuantityUnit',
  ])
    expect(body).not.toHaveProperty(key);
  expect(input.requisitionLineItems[0].stockOnHand).toBe(5);
});
