import { useTranslation } from 'react-i18next';
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

export function KitUnpackListSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-4">
      <DataTableCard>
        <Table density="comfortable">
          <TableHeader surface="muted">
            <TableRow>
              <TableHead>
                <DataTableHeaderLabel>{t('products.kit.product')}</DataTableHeaderLabel>
              </TableHead>
              <TableHead>
                <DataTableHeaderLabel>{t('products.kit.quantity')}</DataTableHeaderLabel>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((row) => (
              <TableRow key={row}>
                <TableCell>
                  <Block className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Block className="h-8 w-28" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableCard>
    </div>
  );
}

function TabTableSkeleton({ headers }: { headers: string[] }) {
  return (
    <div aria-busy className="flex flex-col gap-4">
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
    </div>
  );
}

export function ProgramLinksSkeleton() {
  const { t } = useTranslation();
  return (
    <TabTableSkeleton headers={[t('products.programs.program'), t('products.programs.category')]} />
  );
}

export function ApprovalsSkeleton() {
  const { t } = useTranslation();
  return (
    <TabTableSkeleton
      headers={[t('products.approvals.facility-type'), t('products.approvals.program')]}
    />
  );
}
