export type PatientMonth = { value?: number | string | null; disabled: boolean };
export type PatientRow = {
  key: string;
  isSkipped: boolean;
  isSkipDisabled?: boolean;
  data: PatientMonth[];
};
export type PatientsData = { TBData: PatientRow[][]; leprosyData: PatientRow[][] };

const tbKeys = [
  'numberOfAdultPatients',
  'numberOfChildren',
  'numberOfRetreatmentPatients',
  'numberOfAdultsOnIPT',
  'numberOfChildrenOnIPT',
];
const leprosyKeys = [
  'numberOfAdultOnMBRegimen',
  'numberOfAdultOnPBRegimen',
  'numberOfChildrenOnMBRegimen',
  'numberOfChildrenOnPBRegimen',
];

export function parsePatients(json: string | null | undefined): PatientsData {
  if (json?.trim()) return JSON.parse(json) as PatientsData;
  const rows = (keys: string[], leprosy = false) =>
    keys.map((key) => ({
      key,
      isSkipped: false,
      isSkipDisabled: false,
      data: Array.from({ length: 12 }, (_, i) => ({
        value: null,
        disabled: i >= (leprosy && key.includes('PB') ? 12 : 6),
      })),
    }));
  return { TBData: [rows(tbKeys)], leprosyData: [rows(leprosyKeys, true)] };
}

export function patientsForProduct(data: PatientsData, code: string): number {
  const rows = [...(data.TBData[0] ?? []), ...(data.leprosyData[0] ?? [])];
  const sum = (key: string, start: number, end: number) =>
    rows
      .find((row) => row.key === key)
      ?.data.slice(start, end)
      .reduce((total, month) => total + (Number.parseInt(String(month.value), 10) || 0), 0) ?? 0;
  switch (code) {
    case '10010510AE':
      return sum('numberOfAdultPatients', 0, 2);
    case '10010508AE':
      return sum('numberOfChildren', 2, 6);
    case '10010110AE':
      return sum('numberOfAdultOnMBRegimen', 0, 6) + sum('numberOfAdultOnPBRegimen', 0, 12);
    case '10010515AE':
    case '10010233AE':
      return sum('numberOfChildrenOnIPT', 0, 2);
    case '10010514AE':
      return sum('numberOfChildrenOnIPT', 2, 6);
    case '10010113AE':
      return sum('numberOfChildrenOnMBRegimen', 0, 6) + sum('numberOfChildrenOnPBRegimen', 0, 12);
    case '10010114AE':
      return sum('numberOfChildrenOnIPT', 0, 6);
    case '10010315AE':
      return sum('numberOfAdultsOnIPT', 0, 6);
    default:
      return 0;
  }
}

export type PatientQuantities = {
  totalRequirement: number | null;
  totalQuantityNeededByHf: number | null;
  quantityToIssue: number | null;
  convertedQuantityToIssue: number | null;
};

export function calculatePatientQuantities(
  patients: number | null | undefined,
  doses: number | null | undefined,
  stockOnHand: number | null | undefined,
  netContent: number | null | undefined,
  stored: Partial<PatientQuantities> = {},
): PatientQuantities & { notAvailable: boolean } {
  if (!doses)
    return {
      notAvailable: true,
      totalRequirement: null,
      totalQuantityNeededByHf: null,
      quantityToIssue: null,
      convertedQuantityToIssue: null,
    };
  const totalRequirement =
    stored.totalRequirement !== undefined
      ? stored.totalRequirement
      : stockOnHand == null
        ? 0
        : (patients ?? 0) * doses;
  const totalQuantityNeededByHf =
    stored.totalQuantityNeededByHf !== undefined
      ? stored.totalQuantityNeededByHf
      : stockOnHand == null
        ? 0
        : 2 * (totalRequirement ?? 0);
  const quantityToIssue =
    stored.quantityToIssue !== undefined
      ? stored.quantityToIssue
      : Math.max((totalQuantityNeededByHf ?? 0) - (stockOnHand ?? 0), 0);
  return {
    notAvailable: false,
    totalRequirement,
    totalQuantityNeededByHf,
    quantityToIssue,
    convertedQuantityToIssue:
      stored.convertedQuantityToIssue !== undefined
        ? stored.convertedQuantityToIssue
        : netContent
          ? Math.floor((quantityToIssue ?? 0) / netContent)
          : 0,
  };
}
