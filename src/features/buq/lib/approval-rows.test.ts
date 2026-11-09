import { expect, it } from 'vitest';
import { approvalRows } from '@/features/buq/lib/approval-rows';
import type { BuqForApproval } from '@/features/buq/lib/types';

const REGION = { id: 'z1', code: 'NIA', name: 'Niassa', level: { code: 'Region', name: 'Region' } };
const PROVINCE = {
  id: 'z3',
  code: 'NOR',
  name: 'North',
  level: { code: 'Province', name: 'Province' },
  parent: REGION,
};
const DISTRICT = {
  id: 'z2',
  code: 'CUA',
  name: 'Cuamba',
  level: { code: 'District', name: 'District' },
  parent: PROVINCE,
};
const TYPE = { id: 't1', code: 'health_center', name: 'Health Center' };
const FACILITIES = [
  { id: 'f1', code: 'N003', name: 'Cuamba, Cuamba', type: TYPE, geographicZone: DISTRICT },
  {
    id: 'f2',
    code: 'N007',
    name: 'Lurio, Cuamba',
    type: TYPE,
    geographicZone: { ...DISTRICT, parent: null },
  },
];
const PERIODS = [
  { id: 'p1', name: 'July 2016 - June 2017' },
  { id: 'p2', name: 'July 2017 - June 2018' },
];

const forecast = (
  id: string,
  facilityId: string,
  processingPeriodId: string,
  statusChanges: BuqForApproval['statusChanges'],
): BuqForApproval => ({
  id,
  facilityId,
  processingPeriodId,
  programId: 'g1',
  targetYear: 2017,
  status: 'AUTHORIZED',
  statusChanges,
});

it('joins facility, zones and period, dates from the latest authorization, oldest first', () => {
  const rows = approvalRows(
    [
      forecast('b1', 'f1', 'p2', [
        { status: 'SUBMITTED', occurredDate: '2026-11-04T09:00:00Z' },
        { status: 'AUTHORIZED', occurredDate: '2026-09-03T10:00:00Z' },
        { status: 'REJECTED', occurredDate: '2026-09-20T10:00:00Z' },
        { status: 'AUTHORIZED', occurredDate: '2026-11-05T10:00:00Z' },
        { status: 'IN_APPROVAL', occurredDate: '2026-11-06T10:00:00Z' },
      ]),
      forecast('b2', 'f2', 'p1', [{ status: 'AUTHORIZED', occurredDate: '2026-10-01T08:00:00Z' }]),
    ],
    FACILITIES,
    PERIODS,
  );

  expect(rows).toEqual([
    {
      id: 'b2',
      facilityCode: 'N007',
      facilityName: 'Lurio, Cuamba',
      facilityType: 'Health Center',
      district: 'Cuamba',
      region: '',
      periodName: 'July 2016 - June 2017',
      submittedAt: '2026-10-01T08:00:00Z',
    },
    {
      id: 'b1',
      facilityCode: 'N003',
      facilityName: 'Cuamba, Cuamba',
      facilityType: 'Health Center',
      district: 'Cuamba',
      region: 'Niassa',
      periodName: 'July 2017 - June 2018',
      submittedAt: '2026-11-05T10:00:00Z',
    },
  ]);
});
