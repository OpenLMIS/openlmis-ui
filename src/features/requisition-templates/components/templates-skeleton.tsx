import { DataTableSkeleton } from '@/components/data-table/data-table';
import { SkeletonLine } from '@/components/dialog-parts';
import { useTemplatesTable } from '@/features/requisition-templates/components/program-templates';

export function TemplatesSkeleton() {
  const table = useTemplatesTable();
  return (
    <div className="flex flex-col gap-6">
      {[0, 1, 2].map((section) => (
        <div className="flex flex-col gap-3" key={section}>
          <SkeletonLine width="short" />
          <DataTableSkeleton layout="auto" pagination="none" rowCount={2} table={table} />
        </div>
      ))}
    </div>
  );
}
