type PatientMonths = { row: string; months: readonly [first: number, last: number] };

// Legacy's fixed TB Monthly formulas: TC sums these Patients tab months (1-based, inclusive).
export const TB_MONTHLY_FORMULAS: Readonly<Record<string, readonly PatientMonths[]>> = {
  // RHZE 150/75/400/275 mg
  '10010510AE': [{ row: 'numberOfAdultPatients', months: [1, 2] }],
  // RH 150/75 mg
  '10010508AE': [{ row: 'numberOfChildren', months: [3, 6] }],
  // MB blister, adult
  '10010110AE': [
    { row: 'numberOfAdultOnMBRegimen', months: [1, 6] },
    { row: 'numberOfAdultOnPBRegimen', months: [1, 12] },
  ],
  // RHZ 75/50/150 mg
  '10010515AE': [{ row: 'numberOfChildrenOnIPT', months: [1, 2] }],
  // Ethambutol 100 mg
  '10010233AE': [{ row: 'numberOfChildrenOnIPT', months: [1, 2] }],
  // RH 75/50 mg
  '10010514AE': [{ row: 'numberOfChildrenOnIPT', months: [3, 6] }],
  // MB blister, child
  '10010113AE': [
    { row: 'numberOfChildrenOnMBRegimen', months: [1, 6] },
    { row: 'numberOfChildrenOnPBRegimen', months: [1, 12] },
  ],
  // Isoniazid 100 mg
  '10010114AE': [{ row: 'numberOfChildrenOnIPT', months: [1, 6] }],
  // Isoniazid 300 mg
  '10010315AE': [{ row: 'numberOfAdultsOnIPT', months: [1, 6] }],
};
