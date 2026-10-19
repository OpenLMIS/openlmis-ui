import { useTranslation } from 'react-i18next';
import { CardListSkeleton } from '@/components/card-list';
import { DataTableCard, DataTableHeaderLabel } from '@/components/data-table/data-table';
import { FieldSkeleton, SwitchSkeleton } from '@/components/dialog-parts';
import { Block } from '@/components/skeleton-block';
import { FieldGroup } from '@/components/ui/field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCardLayout } from '@/hooks/use-card-view';

const ROWS = [0, 1, 2];

export function ProductGeneralFormSkeleton() {
  const { t } = useTranslation();

  return (
    <div aria-busy className="max-w-xl">
      <FieldGroup>
        <FieldSkeleton label={t('products.form.code')} required />
        <FieldSkeleton label={t('products.form.name')} />
        <FieldSkeleton label={t('products.form.description')} />
        <FieldSkeleton label={t('products.form.dispensing-unit')} required />
        <div className="grid gap-5 @md/field-group:grid-cols-2">
          <FieldSkeleton label={t('products.form.net-content')} required />
          <FieldSkeleton label={t('products.form.pack-rounding-threshold')} required />
        </div>
        <SwitchSkeleton />
      </FieldGroup>
    </div>
  );
}

function TabTableSkeleton({ headers }: { headers: string[] }) {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <TabTable headers={headers} />
    </div>
  );
}

function MeasuredTabSkeleton({ headers, cardRows }: { headers: string[]; cardRows: number }) {
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <div ref={measure}>
      {cards ? (
        <div aria-busy>
          <CardListSkeleton count={ROWS.length} pagination={false} rows={cardRows} />
        </div>
      ) : (
        <TabTableSkeleton headers={headers} />
      )}
    </div>
  );
}

function TabTable({ headers }: { headers: string[] }) {
  return (
    <DataTableCard>
      <Table density="comfortable">
        <TableHeader surface="muted">
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>
                <DataTableHeaderLabel>{header}</DataTableHeaderLabel>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((row) => (
            <TableRow key={row}>
              {headers.map((header) => (
                <TableCell key={header}>
                  <Block className="h-4 w-32" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTableCard>
  );
}

export function ProgramLinksSkeleton() {
  const { t } = useTranslation();
  return (
    <MeasuredTabSkeleton
      cardRows={3}
      headers={[t('products.programs.program'), t('products.programs.category')]}
    />
  );
}

export function ApprovalsSkeleton() {
  const { t } = useTranslation();
  return (
    <MeasuredTabSkeleton
      cardRows={3}
      headers={[t('products.approvals.facility-type'), t('products.approvals.program')]}
    />
  );
}

export function KitUnpackListSkeleton() {
  const { t } = useTranslation();
  return <TabTableSkeleton headers={[t('products.kit.product'), t('products.kit.quantity')]} />;
}
