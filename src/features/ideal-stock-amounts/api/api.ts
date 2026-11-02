import type { CsvTransferApi } from '@/components/file-transfer/types';
import { exportCsv, uploadCsv } from '@/lib/csv-upload';

export const IDEAL_STOCK_AMOUNTS_API: CsvTransferApi = {
  exportCsv: () => exportCsv('/idealStockAmounts'),
  uploadCsv: (file) => uploadCsv('/idealStockAmounts', file),
  exportFilename: 'ideal_stock_amounts.csv',
  emptyFileKeys: ['referenceData.error.upload.file.empty'],
};
