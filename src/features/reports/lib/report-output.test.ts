import { describe, expect, it } from 'vitest';
import { classifyReportOutput, reportFileName } from '@/features/reports/lib/report-output';

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);
const PDF = text('%PDF-1.5\n');
const OLE2 = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00);

describe('classifyReportOutput', () => {
  it('opens only a requested PDF whose bytes are a PDF', () => {
    expect(classifyReportOutput('pdf', PDF)).toEqual({
      open: true,
      extension: 'pdf',
      type: 'application/pdf',
    });
    expect(classifyReportOutput('pdf', text('<html><script>'))).toBeNull();
    expect(classifyReportOutput('pdf', bytes())).toBeNull();
  });

  it('saves OLE2 bytes as .xls whatever media type the server sent', () => {
    expect(classifyReportOutput('xls', OLE2)).toEqual({
      open: false,
      extension: 'xls',
      type: 'application/vnd.ms-excel',
    });
    expect(classifyReportOutput('xlsx', OLE2)).toBeNull();
  });

  it('saves a PDF sent for another format as .pdf and says it was substituted', () => {
    expect(classifyReportOutput('xlsx', PDF)).toEqual({
      open: false,
      extension: 'pdf',
      type: 'application/pdf',
      substitutedFor: 'xlsx',
    });
  });

  it('downloads spreadsheets, CSV and HTML, never rendering HTML', () => {
    expect(classifyReportOutput('xlsx', ZIP)).toMatchObject({ open: false, extension: 'xlsx' });
    expect(classifyReportOutput('xls', ZIP)).toBeNull();
    expect(classifyReportOutput('csv', text('"Facility","Code"\n'))).toEqual({
      open: false,
      extension: 'csv',
      type: 'text/csv',
    });
    expect(classifyReportOutput('html', text('<html><script>alert(1)</script>'))).toEqual({
      open: false,
      extension: 'html',
      type: 'application/octet-stream',
    });
    expect(classifyReportOutput('csv', OLE2)).toBeNull();
    expect(classifyReportOutput('html', ZIP)).toBeNull();
  });
});

describe('reportFileName', () => {
  it('keeps the server stem and the true extension', () => {
    expect(
      reportFileName('Facility_Assignment_Configuration_Errors.xls', 'Facility Assignment', 'xls'),
    ).toBe('Facility_Assignment_Configuration_Errors.xls');
    expect(reportFileName('Timeliness_Report.xlsx', 'Timeliness Report', 'pdf')).toBe(
      'Timeliness_Report.pdf',
    );
  });

  it('falls back to the report name and removes unsafe characters', () => {
    expect(reportFileName(undefined, 'Stock On Hand', 'csv')).toBe('Stock_On_Hand.csv');
    expect(reportFileName('../../etc/passwd', 'Report', 'csv')).toBe('passwd.csv');
    expect(reportFileName('a:b*c?.html', 'Report', 'html')).toBe('a_b_c_.html');
    expect(reportFileName('...', '', 'pdf')).toBe('report.pdf');
  });
});
