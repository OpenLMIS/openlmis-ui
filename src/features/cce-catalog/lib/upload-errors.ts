import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { serverMessage, serverMessageKey } from '@/components/display/dialog-parts';

type InvalidValueKind = 'energy-source' | 'storage-temperature' | 'dimensions' | 'integer';

type CatalogUploadIssue =
  | { kind: 'unknown-columns' | 'missing-columns'; columns: string }
  | { kind: 'byte-order-mark' }
  | { kind: 'missing-heading'; column: string }
  | { kind: InvalidValueKind; line: number; value: string }
  | { kind: 'empty-cell'; line: number }
  | { kind: 'row'; line: number; reason: string }
  | { kind: 'duplicate-in-file'; manufacturer: string; model: string };

// Mandatory columns of the cce catalog CSV, as headed in its export.
const REQUIRED_COLUMNS =
  'From PQS catalog, Type, Model, Manufacturer, Energy source, Storage temperature, Archived';

const INVALID_VALUE_KINDS = new Map<string, InvalidValueKind>([
  ['EnergySource', 'energy-source'],
  ['StorageTemperature', 'storage-temperature'],
  ['Dimensions', 'dimensions'],
  ['Integer', 'integer'],
]);

/** Reads a refused catalog upload from the service's English message; undefined if unknown. */
export function catalogUploadIssue(error: unknown): CatalogUploadIssue | undefined {
  if (!isAxiosError(error) || error.response?.status !== 400) return undefined;
  const key = serverMessageKey(error);
  const message = serverMessage(error);
  if (!key || !message) return undefined;

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
      if (match[2] === 'null value encountered') return { kind: 'empty-cell', line };
      const parsed = /^'(.*)' could not be parsed as (?:an? )?(\w+)$/.exec(match[2]);
      const kind = parsed && INVALID_VALUE_KINDS.get(parsed[2]);
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

export function describeCatalogUploadError(error: unknown, t: TFunction): string | undefined {
  const issue = catalogUploadIssue(error);
  if (!issue) return undefined;
  const { kind, ...values } = issue;
  return t(`cce-catalog.error.${kind}`, { columns: REQUIRED_COLUMNS, ...values });
}
