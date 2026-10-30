import type { CsvTransferApi } from '@/components/file-transfer/csv-transfer';
import { exportCsv, type UploadResult, uploadCsv } from '@/lib/csv-upload';

export function exportIdealStockAmounts(): Promise<Blob> {
  return exportCsv('/idealStockAmounts');
}

export function uploadIdealStockAmounts(file: File): Promise<UploadResult> {
  return uploadCsv('/idealStockAmounts', file);
}

export const IDEAL_STOCK_AMOUNTS_API: CsvTransferApi = {
  exportCsv: exportIdealStockAmounts,
  uploadCsv: uploadIdealStockAmounts,
  exportFilename: 'ideal_stock_amounts.csv',
  emptyFileKeys: ['referenceData.error.upload.file.empty'],
};
