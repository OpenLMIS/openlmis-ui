import type { CsvTransferApi } from '@/components/file-transfer/types';
import { exportCsv, uploadCsv } from '@/lib/csv-upload';

export const CCE_CATALOG_API: CsvTransferApi = {
  exportCsv: () => exportCsv('/catalogItems'),
  uploadCsv: (file) => uploadCsv('/catalogItems', file),
  exportFilename: 'catalog_items.csv',
};
