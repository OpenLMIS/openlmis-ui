import { createFileRoute } from '@tanstack/react-router';
import {
  detailPagingSchema,
  transactionHistorySearchSchema,
} from '@/features/stock-events/lib/search';

export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/transaction-history_/$eventId',
)({
  validateSearch: transactionHistorySearchSchema.extend(detailPagingSchema.shape),
  staticData: {
    crumbKey: 'transaction-history.details-crumb',
    crumbParentSearch: (search) => transactionHistorySearchSchema.parse(search),
  },
  component: StockEventPage,
});

function StockEventPage() {
  return null;
}
