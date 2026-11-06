type PatientMonths = { row: string; months: readonly [first: number, last: number] };

export const TB_MONTHLY_FORMULAS: Readonly<Record<string, readonly PatientMonths[]>> = {
  '10010510AE': [{ row: 'numberOfAdultPatients', months: [1, 2] }],
  '10010508AE': [{ row: 'numberOfChildren', months: [3, 6] }],
  '10010110AE': [
    { row: 'numberOfAdultOnMBRegimen', months: [1, 6] },
    { row: 'numberOfAdultOnPBRegimen', months: [1, 12] },
  ],
  '10010515AE': [{ row: 'numberOfChildrenOnIPT', months: [1, 2] }],
  '10010233AE': [{ row: 'numberOfChildrenOnIPT', months: [1, 2] }],
  '10010514AE': [{ row: 'numberOfChildrenOnIPT', months: [3, 6] }],
  '10010113AE': [
    { row: 'numberOfChildrenOnMBRegimen', months: [1, 6] },
    { row: 'numberOfChildrenOnPBRegimen', months: [1, 12] },
  ],
  '10010114AE': [{ row: 'numberOfChildrenOnIPT', months: [1, 6] }],
  '10010315AE': [{ row: 'numberOfAdultsOnIPT', months: [1, 6] }],
};
