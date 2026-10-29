import { expect, it } from 'vitest';
import {
  calculatePatientQuantities,
  parsePatients,
  patientsForProduct,
} from '@/features/requisitions/lib/patients';

const row = (key: string) => ({
  key,
  isSkipped: false,
  data: Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), disabled: i >= 6 })),
});
const data = JSON.stringify({
  TBData: [
    [
      ...[
        'numberOfAdultPatients',
        'numberOfChildren',
        'numberOfChildrenOnIPT',
        'numberOfAdultsOnIPT',
      ].map(row),
    ],
  ],
  leprosyData: [
    [
      ...[
        'numberOfAdultOnMBRegimen',
        'numberOfAdultOnPBRegimen',
        'numberOfChildrenOnMBRegimen',
        'numberOfChildrenOnPBRegimen',
      ].map(row),
    ],
  ],
});

it.each([
  ['10010510AE', 3],
  ['10010508AE', 18],
  ['10010110AE', 99],
  ['10010515AE', 3],
  ['10010233AE', 3],
  ['10010514AE', 18],
  ['10010113AE', 99],
  ['10010114AE', 21],
  ['10010315AE', 21],
  ['unknown', 0],
])('maps TC for product %s', (code, expected) => {
  expect(patientsForProduct(parsePatients(data), code)).toBe(expected);
});
it('preserves stored skip and enabled months without writing or sharing defaults across records', () => {
  const stored = { TBData: [[{ ...row('numberOfChildren'), isSkipped: true }]], leprosyData: [[]] };
  const json = JSON.stringify(stored);
  expect(parsePatients(json)).toEqual(stored);
  const defaults = parsePatients(null);
  expect(defaults.TBData[0]).toHaveLength(5);
  expect(defaults.leprosyData[0]).toHaveLength(4);
  expect(defaults.TBData[0]?.[0]?.data.filter((m) => !m.disabled)).toHaveLength(6);
  expect(defaults.leprosyData[0]?.[1]?.data.filter((m) => !m.disabled)).toHaveLength(12);
  expect(defaults.leprosyData[0]?.[0]?.data.filter((m) => !m.disabled)).toHaveLength(6);
  expect(patientsForProduct(parsePatients(null), '10010508AE')).toBe(0);
});
it('derives TE to TH, including empty E, shortage clamps and zero doses not available', () => {
  expect(calculatePatientQuantities(3, 10, 5, 10)).toEqual({
    notAvailable: false,
    totalRequirement: 30,
    totalQuantityNeededByHf: 60,
    quantityToIssue: 55,
    convertedQuantityToIssue: 5,
  });
  expect(calculatePatientQuantities(3, 10, null, 10).totalRequirement).toBe(0);
  expect(calculatePatientQuantities(3, 10, 100, 10).quantityToIssue).toBe(0);
  expect(calculatePatientQuantities(3, 0, 5, 10)).toEqual({
    notAvailable: true,
    totalRequirement: null,
    totalQuantityNeededByHf: null,
    quantityToIssue: null,
    convertedQuantityToIssue: null,
  });
});

it('uses stored patient inputs for each subsequent calculation and preserves empty inputs', () => {
  expect(calculatePatientQuantities(3, 10, 5, 10, { totalRequirement: 40 })).toMatchObject({
    totalRequirement: 40,
    totalQuantityNeededByHf: 80,
    quantityToIssue: 75,
    convertedQuantityToIssue: 7,
  });
  expect(calculatePatientQuantities(3, 10, 5, 10, { totalQuantityNeededByHf: 90 })).toMatchObject({
    quantityToIssue: 85,
    convertedQuantityToIssue: 8,
  });
  expect(calculatePatientQuantities(3, 10, 5, 10, { quantityToIssue: 105 })).toMatchObject({
    convertedQuantityToIssue: 10,
  });
  expect(calculatePatientQuantities(3, 10, 5, 10, { totalRequirement: null })).toMatchObject({
    notAvailable: false,
    totalRequirement: null,
    totalQuantityNeededByHf: 0,
  });
});
