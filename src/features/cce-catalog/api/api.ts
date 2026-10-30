import type { CsvTransferApi } from '@/components/file-transfer/csv-transfer';
import { exportCsv, type UploadResult, uploadCsv } from '@/lib/csv-upload';

export function exportCatalog(): Promise<Blob> {
  return exportCsv('/catalogItems');
}

export function uploadCatalog(file: File): Promise<UploadResult> {
  return uploadCsv('/catalogItems', file);
}

export const CCE_CATALOG_API: CsvTransferApi = {
  exportCsv: exportCatalog,
  uploadCsv: uploadCatalog,
  exportFilename: 'catalog_items.csv',
};
