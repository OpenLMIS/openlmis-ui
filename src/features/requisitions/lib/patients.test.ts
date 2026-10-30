import { expect, it } from 'vitest';
import legacy from '@/features/requisitions/lib/fixtures/patients-legacy.json';
import {
  calculatePatientQuantities,
  parsePatients,
  patientFieldId,
  patientsForProduct,
  rebasePatientChanges,
  validatePatients,
  writePatients,
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
  expect(parsePatients(json).TBData[0][0]).toMatchObject({
    key: 'numberOfChildren',
    isSkipped: true,
  });
  expect(parsePatients(json).TBData[0][0].data[0]).toEqual({ value: 1, disabled: false });
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

it('writes captured legacy rows with canonical focus and validation flags', () => {
  const parsed = parsePatients(JSON.stringify(legacy));
  const written = JSON.parse(writePatients(parsed)) as typeof legacy;
  expect(written).toEqual(legacy);
  parsed.TBData[0][0].data[0].value = 2147483648;
  parsed.TBData[0][0].data[6] = { value: 998, disabled: true };
  const flagged = JSON.parse(writePatients(parsed)) as typeof legacy;
  expect(flagged.TBData[0][0].data[0]).toMatchObject({
    value: 2147483648,
    isInvalid: true,
    isFocused: false,
  });
  expect(flagged.TBData[0][0].data[6]).toEqual({
    value: '',
    disabled: true,
    isInvalid: false,
    isFocused: false,
  });
  expect(writePatients(parsePatients(writePatients(parsed)))).toBe(writePatients(parsed));
});
it('validates enabled unskipped months and guards both counts and computed totals', () => {
  const data = parsePatients(null);
  expect(Object.keys(validatePatients(data, true))).toHaveLength(66);
  data.TBData[0][0].isSkipped = true;
  expect(Object.keys(validatePatients(data, true))).toHaveLength(60);
  data.TBData[0][1].data[2].value = 2147483647;
  data.TBData[0][1].data[3].value = 1;
  expect(Object.values(validatePatients(data, false))).toContain('stock-events.number-too-large');
  expect(patientFieldId('TBData', 'numberOfChildren', 2)).toBe(
    'patients:TBData:numberOfChildren:2',
  );
});
it('keeps malformed data unreadable instead of silently replacing it', () => {
  expect(parsePatients('{broken')).toMatchObject({ unreadable: true });
  expect(validatePatients(parsePatients('{broken'), true)).toHaveProperty('patients');
});

it('marks only contributors when a TC overflows across two patient rows', () => {
  const data = parsePatients(null);
  data.TBData[0][0].data[0].value = 1;
  data.leprosyData[0][0].data[0].value = 2147483647;
  data.leprosyData[0][1].data[0].value = 1;
  const errors = validatePatients(data);
  expect(errors[patientFieldId('leprosyData', 'numberOfAdultOnMBRegimen', 0)]).toBe(
    'stock-events.number-too-large',
  );
  expect(errors[patientFieldId('leprosyData', 'numberOfAdultOnPBRegimen', 0)]).toBe(
    'stock-events.number-too-large',
  );
  expect(errors).not.toHaveProperty(patientFieldId('TBData', 'numberOfAdultPatients', 0));
});

it('keeps unchanged patient row overrides stable while editing another row', () => {
  const unchanged = { values: { 0: '5' } };
  const changes = {
    'TBData:numberOfAdultPatients': { values: { 0: '2' } },
    'TBData:numberOfChildren': unchanged,
  };
  const rebased = rebasePatientChanges(parsePatients(null), changes);
  expect(rebased?.['TBData:numberOfChildren']).toBe(unchanged);
});

it('distinguishes untouched, cleared and disabled months in the legacy payload', () => {
  const data = parsePatients(null);
  data.TBData[0][0].data[0].value = null;
  const written = parsePatients(writePatients(data));
  expect(written.TBData[0][0].data[0].value).toBeNull();
  expect(written.TBData[0][0].data[1].value).toBe('');
  expect(written.TBData[0][0].data[6].value).toBe('');
});
