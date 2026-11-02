import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';

export type CatalogUploadIssue =
  | { kind: 'unknown-columns'; columns: string }
  | { kind: 'byte-order-mark' }
  | { kind: 'missing-columns'; columns: string }
  | { kind: 'missing-heading'; column: string }
  | {
      kind: 'energy-source' | 'storage-temperature' | 'dimensions' | 'integer';
      line: number;
      value: string;
    }
  | { kind: 'empty-cell'; line: number; columns: string }
  | { kind: 'row'; line: number; reason: string }
  | { kind: 'duplicate-in-file'; manufacturer: string; model: string };

// Mandatory columns of the cce catalog CSV, as headed in its export.
const REQUIRED_COLUMNS =
  'From PQS catalog, Type, Model, Manufacturer, Energy source, Storage temperature, Archived';

const PARSED_AS = {
  EnergySource: 'energy-source',
  StorageTemperature: 'storage-temperature',
  Dimensions: 'dimensions',
  Integer: 'integer',
} as const;

/** Reads a refused catalog upload from the service's English message; undefined if unknown. */
export function catalogUploadIssue(error: unknown): CatalogUploadIssue | undefined {
  if (!isAxiosError(error) || error.response?.status !== 400) return undefined;
  const body: unknown = error.response.data;
  if (!body || typeof body !== 'object') return undefined;
  const key = 'messageKey' in body ? body.messageKey : undefined;
  const message = 'message' in body ? body.message : undefined;
  if (typeof key !== 'string' || typeof message !== 'string') return undefined;

  switch (key) {
    case 'cce.error.upload.header.invalid': {
      const columns = /^Invalid Headers in upload file: \[(.+)\]\.$/.exec(message)?.[1];
      if (!columns) return undefined;
      // Excel's CSV UTF-8 adds a byte order mark, which the server keeps in the first heading.
      if (columns.startsWith('\uFEFF')) return { kind: 'byte-order-mark' };
      return { kind: 'unknown-columns', columns };
    }
    case 'cce.error.upload.mandatory.columns.missing': {
      const columns = /^Missing Mandatory column in upload file: \[(.+)\]\.$/.exec(message)?.[1];
      return columns ? { kind: 'missing-columns', columns } : undefined;
    }
    case 'cce.error.upload.header.missing': {
      const column = /^Header for column (\d+) is missing\.$/.exec(message)?.[1];
      return column ? { kind: 'missing-heading', column } : undefined;
    }
    case 'cce.error.upload.record.invalid': {
      const match = /^Error found while parsing in row (\d+): (.+)\.$/.exec(message);
      if (!match) return undefined;
      // The server counts data rows from 1, so its row 1 is the second line of the file.
      const line = Number(match[1]) + 1;
      if (match[2] === 'null value encountered')
        return { kind: 'empty-cell', line, columns: REQUIRED_COLUMNS };
      const parsed = /^'(.*)' could not be parsed as (?:an? )?(\w+)$/.exec(match[2]);
      const kind = parsed && PARSED_AS[parsed[2] as keyof typeof PARSED_AS];
      return kind ? { kind, line, value: parsed[1] } : { kind: 'row', line, reason: match[2] };
    }
    case 'cce.error.catalog.duplicateInFile': {
      const match = /with manufacturer (.+) and model (.+)\.$/.exec(message);
      return match
        ? { kind: 'duplicate-in-file', manufacturer: match[1], model: match[2] }
        : undefined;
    }
    default:
      return undefined;
  }
}

export function catalogUploadErrorText(
  { kind, ...values }: CatalogUploadIssue,
  t: TFunction,
): string {
  return t(`cce-catalog.error.${kind}`, values);
}
