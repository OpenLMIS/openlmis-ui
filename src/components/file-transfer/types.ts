import type { UploadResult } from '@/lib/csv-upload';

export type CsvTransferApi = {
  exportCsv: () => Promise<Blob>;
  uploadCsv: (file: File) => Promise<UploadResult>;
  exportFilename: string;
  /** Server message keys that mean the uploaded file was empty. */
  emptyFileKeys?: readonly string[];
};

export type CsvTransferCopy = {
  exportLabel: string;
  uploadLabel: string;
  /** Shown when the upload outcome is unknown. */
  uploadError: string;
};
