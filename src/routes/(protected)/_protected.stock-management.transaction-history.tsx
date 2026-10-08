import { createFileRoute } from '@tanstack/react-router';
import { transactionHistorySearchSchema } from '@/features/stock-events/lib/search';

export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/transaction-history',
)({
  validateSearch: transactionHistorySearchSchema,
  component: TransactionHistoryPage,
});

function TransactionHistoryPage() {
  return null;
}
