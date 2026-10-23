import { homeStockProvider } from '@/features/stock-events/lib/home-stock-provider';
import { receiveCatalogProvider } from '@/features/stock-events/lib/receive-catalog-provider';

export const stockEventDownloadProviders = () => [homeStockProvider(), receiveCatalogProvider()];
