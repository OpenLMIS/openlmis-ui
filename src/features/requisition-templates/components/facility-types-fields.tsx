import { useStore } from '@tanstack/react-form';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableCard,
  DataTableEmpty,
  DataTableHeaderLabel,
} from '@/components/data-table/data-table';
import { useAppForm } from '@/components/form/form';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { facilityTypeName } from '@/features/reference-data/lib/facility-types';
import type { FacilityType } from '@/features/reference-data/lib/types';

export function FacilityTypesFields({
  options,
  types,
  selected,
  onChange,
  disabled,
  description,
  error,
  emptyTitle,
  emptyDescription,
  label,
  addLabel,
}: {
  label?: string;
  addLabel?: string;
  options: FacilityType[];
  types: FacilityType[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  description?: ReactNode;
  error?: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const { t } = useTranslation();
  const errorId = useId();
  const picker = useAppForm({ defaultValues: { facilityTypeId: null as string | null } });
  const pickedId = useStore(picker.store, (state) => state.values.facilityTypeId);
  const names = new Map(types.map((type) => [type.id, facilityTypeName(type)]));
  const rows = selected
    .map((id) => ({ id, name: names.get(id) ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const picked = options.some(({ id }) => id === pickedId);
  const tableRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const remove = (id: string, index: number) => {
    onChange(selected.filter((value) => value !== id));
    requestAnimationFrame(() => {
      const buttons = tableRef.current?.querySelectorAll<HTMLButtonElement>('[data-remove-type]');
      (
        buttons?.[Math.min(index, buttons.length - 1)] ??
        pickerRef.current?.querySelector<HTMLInputElement>('input')
      )?.focus();
    });
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1" ref={pickerRef}>
          <picker.AppField name="facilityTypeId">
            {(field) => (
              <field.ComboboxField
                invalid={Boolean(error)}
                describedBy={error ? errorId : undefined}
                disabled={disabled || !options.length}
                description={description}
                clearLabel={t('requisition-templates.form.clear-facility-type')}
                emptyMessage={t('requisition-templates.form.no-types-left')}
                items={options.map((type) => ({ value: type.id, label: facilityTypeName(type) }))}
                label={label ?? t('requisition-templates.configure.facility-type')}
                placeholder={t('requisition-templates.form.pick-facility-type')}
              />
            )}
          </picker.AppField>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!picked}
          onClick={() => {
            if (pickedId && picked) {
              onChange([...selected, pickedId]);
              picker.setFieldValue('facilityTypeId', null);
            }
          }}
        >
          <PlusIcon data-icon="inline-start" />
          {addLabel ?? t('requisition-templates.configure.add')}
        </Button>
      </div>
      <div ref={tableRef}>
        <DataTableCard>
          <Table density="comfortable" layout="auto">
            <TableHeader surface="muted">
              <TableRow>
                <TableHead>
                  <DataTableHeaderLabel>
                    {t('requisition-templates.configure.facility-type')}
                  </DataTableHeaderLabel>
                </TableHead>
                <TableHead>
                  <DataTableHeaderLabel>{t('requisition-templates.action')}</DataTableHeaderLabel>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span dir="auto">{row.name}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          data-remove-type
                          aria-label={t('requisition-templates.form.remove-type', {
                            type: row.name,
                          })}
                          onClick={() => remove(row.id, index)}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2}>
                    <DataTableEmpty title={emptyTitle} description={emptyDescription} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableCard>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
