import type { ReportFormat } from '@/features/reports/lib/types';

export type ReportOutput = {
  /** Only a verified PDF may open in a tab; everything else downloads. */
  open: boolean;
  extension: 'pdf' | 'csv' | 'xls' | 'xlsx' | 'html';
  type: string;
  /** The format asked for when the server sent a PDF instead. */
  substitutedFor?: ReportFormat;
};

/** Enough of the file to recognise it. */
export const OUTPUT_HEAD_BYTES = 512;

const startsWith = (head: Uint8Array, signature: readonly number[]) =>
  signature.every((byte, index) => head[index] === byte);

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP = [0x50, 0x4b, 0x03, 0x04];

/** What the server actually sent, judged by its first bytes, or null when it is not what was asked for. */
export function classifyReportOutput(
  requested: ReportFormat,
  head: Uint8Array,
): ReportOutput | null {
  if (startsWith(head, PDF))
    return requested === 'pdf'
      ? { open: true, extension: 'pdf', type: 'application/pdf' }
      : { open: false, extension: 'pdf', type: 'application/pdf', substitutedFor: requested };
  if (startsWith(head, OLE2))
    return requested === 'xls'
      ? { open: false, extension: 'xls', type: 'application/vnd.ms-excel' }
      : null;
  if (startsWith(head, ZIP))
    return requested === 'xlsx'
      ? {
          open: false,
          extension: 'xlsx',
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }
      : null;
  if (head.includes(0)) return null;
  if (requested === 'csv') return { open: false, extension: 'csv', type: 'text/csv' };
  if (requested === 'html')
    return { open: false, extension: 'html', type: 'application/octet-stream' };
  return null;
}

const UNSAFE = /[\\/:*?"<>|\p{Cc}]/gu;

const safeStem = (name: string) =>
  name
    .replace(UNSAFE, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 150);

/** The server's file name stem, or the report's name, with the extension of what was really sent. */
export function reportFileName(
  serverName: string | undefined,
  reportName: string,
  extension: ReportOutput['extension'],
) {
  const base =
    serverName
      ?.split(/[\\/]/)
      .pop()
      ?.replace(/\.[^.]*$/, '') ?? '';
  const stem = safeStem(base) || safeStem(reportName) || 'report';
  return `${stem}.${extension}`;
}
