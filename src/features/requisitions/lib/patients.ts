import type { ParseKeys } from 'i18next';
import { MAX_WHOLE_NUMBER, toLatinDigits, wholeNumberText } from '@/lib/whole-number';

export const PATIENT_QUANTITY_COLUMNS = [
  'totalRequirement',
  'totalQuantityNeededByHf',
  'quantityToIssue',
  'convertedQuantityToIssue',
] as const;

export type PatientMonth = { value?: number | string | null; disabled: boolean };
export type PatientDisease = 'TBData' | 'leprosyData';
export type PatientRow = {
  key: string;
  title?: string;
  isSkipped: boolean;
  isSkipDisabled?: boolean;
  data: PatientMonth[];
};
export type PatientsData = {
  TBData: PatientRow[][];
  leprosyData: PatientRow[][];
  unreadable?: boolean;
  original?: string;
};

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
  if (json?.trim()) {
    try {
      const data = JSON.parse(json) as PatientsData;
      for (const disease of ['TBData', 'leprosyData'] as const) {
        if (!Array.isArray(data[disease]) || !Array.isArray(data[disease][0])) throw Error();
        data[disease] = [
          data[disease][0].map((row: PatientRow) => {
            if (typeof row.key !== 'string' || !Array.isArray(row.data)) throw Error();
            return {
              key: row.key,
              title: row.title ?? `requisitionPatientsViewTab.${row.key}.label`,
              isSkipped: !!row.isSkipped,
              data: Array.from({ length: 12 }, (_, index) => {
                const month = row.data[index];
                const value = month?.value;
                if (value != null && typeof value !== 'number' && typeof value !== 'string')
                  throw Error();
                return {
                  value:
                    typeof value === 'string' && value.trim() && /^\d+$/.test(toLatinDigits(value))
                      ? Number(toLatinDigits(value))
                      : (value ?? null),
                  disabled: month ? !!month.disabled : true,
                };
              }),
            };
          }),
        ];
      }
      return data;
    } catch {
      return { TBData: [[]], leprosyData: [[]], unreadable: true, original: json };
    }
  }
  const rows = (keys: string[], leprosy = false) =>
    keys.map((key) => ({
      key,
      isSkipped: false,
      isSkipDisabled: false,
      data: Array.from({ length: 12 }, (_, i) => ({
        value: '',
        disabled: i >= (leprosy && key.includes('PB') ? 12 : 6),
      })),
    }));
  return { TBData: [rows(tbKeys)], leprosyData: [rows(leprosyKeys, true)] };
}

export const PATIENT_MONTHS = Array.from({ length: 12 }, (_, month) => month);
export const PATIENT_DISEASES = ['TBData', 'leprosyData'] as const;
const patientFormulae: Record<string, readonly (readonly [string, number, number])[]> = {
  '10010510AE': [['numberOfAdultPatients', 0, 2]],
  '10010508AE': [['numberOfChildren', 2, 6]],
  '10010110AE': [
    ['numberOfAdultOnMBRegimen', 0, 6],
    ['numberOfAdultOnPBRegimen', 0, 12],
  ],
  '10010515AE': [['numberOfChildrenOnIPT', 0, 2]],
  '10010233AE': [['numberOfChildrenOnIPT', 0, 2]],
  '10010514AE': [['numberOfChildrenOnIPT', 2, 6]],
  '10010113AE': [
    ['numberOfChildrenOnMBRegimen', 0, 6],
    ['numberOfChildrenOnPBRegimen', 0, 12],
  ],
  '10010114AE': [['numberOfChildrenOnIPT', 0, 6]],
  '10010315AE': [['numberOfAdultsOnIPT', 0, 6]],
};
export const PATIENT_CODES = Object.keys(patientFormulae);
export const patientFieldId = (disease: PatientDisease, key: string, month: number) =>
  `patients:${disease}:${key}:${month}`;
export const patientRowHasValues = (row: PatientRow) =>
  row.data.some(({ value }) => value != null && String(value).trim() !== '');
const patientNumber = wholeNumberText(
  {
    required: 'stock-events.required',
    invalid: 'stock-events.positive-number',
    tooLarge: 'stock-events.number-too-large',
  },
  { optional: true },
);
export function patientCountError(value: unknown): ParseKeys | undefined {
  const checked = patientNumber.safeParse(String(value ?? ''));
  return checked.success ? undefined : (checked.error.issues[0].message as ParseKeys);
}
export function validatePatients(
  data: PatientsData,
  complete = false,
  live = false,
): Record<string, ParseKeys> {
  if (data.unreadable) return { patients: 'requisitions.patients.unreadable' };
  const errors: Record<string, ParseKeys> = {};
  for (const disease of PATIENT_DISEASES)
    for (const row of data[disease][0]) {
      row.data.forEach((month, index) => {
        if (month.disabled && (month.value == null || month.value === '')) return;
        const value = String(month.value ?? '');
        const checked = patientNumber.safeParse(value);
        if (!checked.success)
          errors[patientFieldId(disease, row.key, index)] = checked.error.issues[0]
            .message as ParseKeys;
        else if (
          !month.disabled &&
          !row.isSkipped &&
          !value.trim() &&
          (complete || (live && patientRowHasValues(row)))
        )
          errors[patientFieldId(disease, row.key, index)] = 'stock-events.required';
      });
    }
  for (const code of PATIENT_CODES) {
    if (patientsForProduct(data, code) <= MAX_WHOLE_NUMBER) continue;
    for (const disease of PATIENT_DISEASES)
      for (const row of data[disease][0]) {
        for (const [key, start, end] of patientFormulae[code]) {
          if (row.key !== key) continue;
          for (let month = start; month < end; month++) {
            if (Number(row.data[month]?.value) > 0)
              errors[patientFieldId(disease, key, month)] = 'stock-events.number-too-large';
          }
        }
      }
  }
  return errors;
}
export function writePatients(data: PatientsData): string {
  const errors = validatePatients(data, false, true);
  return JSON.stringify(
    Object.fromEntries(
      PATIENT_DISEASES.map((disease) => [
        disease,
        [
          data[disease][0].map((row) => ({
            key: row.key,
            title: row.title ?? `requisitionPatientsViewTab.${row.key}.label`,
            data: row.data.map((month, index) => ({
              value: month.disabled
                ? ''
                : month.value == null
                  ? null
                  : month.value === ''
                    ? ''
                    : Number(toLatinDigits(String(month.value))),
              disabled: month.disabled,
              isInvalid: !!errors[patientFieldId(disease, row.key, index)],
              isFocused: false,
            })),
            isSkipped: row.isSkipped,
            isSkipDisabled: patientRowHasValues(row),
          })),
        ],
      ]),
    ),
  );
}
export type PatientChanges = Record<string, { values?: Record<number, string>; skipped?: boolean }>;
export function applyPatientChanges(
  data: PatientsData,
  changes?: PatientChanges | null,
): PatientsData {
  if (!changes || data.unreadable) return data;
  return {
    ...data,
    ...Object.fromEntries(
      PATIENT_DISEASES.map((disease) => [
        disease,
        [
          data[disease][0].map((row) => {
            const change = changes[`${disease}:${row.key}`];
            if (!change) return row;
            return {
              ...row,
              isSkipped: change.skipped ?? row.isSkipped,
              data: row.data.map((month, index) => {
                if (!Object.hasOwn(change.values ?? {}, index)) return month;
                const text = change.values?.[index] ?? '';
                return { ...month, value: text.trim() ? toLatinDigits(text) : null };
              }),
            };
          }),
        ],
      ]),
    ),
  };
}
export function rebasePatientChanges(
  data: PatientsData,
  changes?: PatientChanges | null,
): PatientChanges | null {
  if (data.unreadable) return changes ?? null;
  const result: PatientChanges = {};
  for (const disease of PATIENT_DISEASES)
    for (const row of data[disease][0]) {
      const id = `${disease}:${row.key}`;
      const change = changes?.[id];
      if (!change) continue;
      const values = Object.fromEntries(
        Object.entries(change.values ?? {}).filter(([index, text]) => {
          const saved = row.data[Number(index)];
          if (!saved || saved.disabled) return false;
          const normalized = toLatinDigits(text.trim());
          if (!normalized) return saved.value != null && saved.value !== '';
          if (!patientNumber.safeParse(normalized).success) return true;
          return (
            saved.value == null || saved.value === '' || Number(saved.value) !== Number(normalized)
          );
        }),
      );
      const skipped =
        change.skipped !== undefined && change.skipped !== row.isSkipped
          ? change.skipped
          : undefined;
      if (Object.keys(values).length || skipped !== undefined)
        result[id] =
          Object.keys(values).length === Object.keys(change.values ?? {}).length &&
          skipped === change.skipped
            ? change
            : {
                ...(Object.keys(values).length ? { values } : {}),
                ...(skipped !== undefined ? { skipped } : {}),
              };
    }
  return Object.keys(result).length ? result : null;
}

export function patientsForProduct(data: PatientsData, code: string): number {
  const rows = [...(data.TBData[0] ?? []), ...(data.leprosyData[0] ?? [])];
  return (patientFormulae[code] ?? []).reduce(
    (total, [key, start, end]) =>
      total +
      (rows
        .find((row) => row.key === key)
        ?.data.slice(start, end)
        .reduce((sum, month) => sum + (Number.parseInt(String(month.value), 10) || 0), 0) ?? 0),
    0,
  );
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
