import { expect, it } from 'vitest';
import {
  eligibleForNewTemplate,
  eligibleForTemplate,
} from '@/features/requisition-templates/lib/eligible-facility-types';

const types = ['z', 'a', 'b', 'c', 'inactive'].map((id) => ({
  id,
  code: id,
  name: id,
  active: id !== 'inactive',
  displayOrder: 1,
  primaryHealthCare: false,
}));
const templates = [
  {
    id: 'regular',
    program: { id: 'p' },
    facilityTypes: [{ id: 'a' }],
    requisitionReportOnly: false,
  },
  { id: 'report', program: { id: 'p' }, facilityTypes: [{ id: 'b' }], requisitionReportOnly: true },
  {
    id: 'other',
    program: { id: 'other' },
    facilityTypes: [{ id: 'c' }],
    requisitionReportOnly: true,
  },
];
it('regular Add excludes every assignment of the program and the selected types', () => {
  expect(eligibleForNewTemplate(types, templates, 'p', false, ['z']).map(({ id }) => id)).toEqual([
    'c',
  ]);
});
it('report only Add excludes only report only assignments and keeps other programs available', () => {
  expect(eligibleForNewTemplate(types, templates, 'p', true, []).map(({ id }) => id)).toEqual([
    'a',
    'c',
    'z',
  ]);
});
it('Settings excludes other templates regardless of report only but permits its own assignments', () => {
  expect(eligibleForTemplate(types, templates, 'p', 'regular', ['z']).map(({ id }) => id)).toEqual([
    'a',
    'c',
  ]);
});
