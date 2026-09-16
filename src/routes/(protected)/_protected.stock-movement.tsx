/* DEMO ONLY - this stock-movement page is a showcase of a 4-step TanStack Form + Zod wizard on top of shadcn primitives. To remove the demo, delete the `-stock-movement/` folder, this route file, the `src/features/stock-movement/` folder, the `src/components/stepper.tsx` and `src/components/date-field.tsx` files (if no other route uses them), and the `stock-movement.title` nav entry in `src/lib/config.ts`. */
import { createFileRoute } from '@tanstack/react-router';
import { StockMovementWizard } from '@/routes/(protected)/-stock-movement/stock-movement-wizard';

export const Route = createFileRoute('/(protected)/_protected/stock-movement')({
  component: StockMovementPage,
});

function StockMovementPage() {
  return (
    <div className="@container/main mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <StockMovementWizard />
    </div>
  );
}
