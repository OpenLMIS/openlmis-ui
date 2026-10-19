import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CardControlRow, CardListSkeleton, SkeletonBar } from '@/components/card-list';
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

function MeasuredTabSkeleton({
  headers,
  cardRows,
  band,
  row,
}: {
  headers: string[];
  cardRows: number;
  band?: ReactNode;
  row?: ReactNode;
}) {
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <div ref={measure}>
      {cards ? (
        <div aria-busy>
          <CardListSkeleton
            band={band}
            count={ROWS.length}
            pagination={false}
            row={row}
            rows={cardRows}
          />
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

export function KitUnpackListSkeleton({ editable = false }: { editable?: boolean }) {
  const { t } = useTranslation();
  return (
    <MeasuredTabSkeleton
      band={
        <>
          <div className="flex flex-col gap-1.5">
            <SkeletonBar width="w-40" />
            <Block className="h-3 w-16" />
          </div>
          {editable && <Block className="size-7" />}
        </>
      }
      cardRows={1}
      row={
        <CardControlRow label={<SkeletonBar width="w-20" />}>
          <Block className="h-8 w-full" />
        </CardControlRow>
      }
      headers={[t('products.kit.product'), t('products.kit.quantity')]}
    />
  );
}
