import { Building2Icon, Trash2Icon } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableCard,
  DataTableEmpty,
  DataTableHeaderLabel,
} from '@/components/data-table/data-table';
import { PickerAdd, PickerAddButton, PickerAddField, PickerAddIcon } from '@/components/picker-add';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
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

type TypeItem = { value: string; label: string };

export function FacilityTypesFields({
  options,
  types,
  selected,
  onChange,
  disabled,
  placeholder,
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
  placeholder?: string;
  error?: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const { t } = useTranslation();
  const errorId = useId();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const names = new Map(types.map((type) => [type.id, facilityTypeName(type)]));
  const rows = selected
    .map((id) => ({ id, name: names.get(id) ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const items = options.map((type) => ({ value: type.id, label: facilityTypeName(type) }));
  const picked = items.find(({ value }) => value === pickedId) ?? null;
  const tableRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const focusPicker = () => pickerRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  const add = () => {
    if (!picked) return;
    onChange([...selected, picked.value]);
    setPickedId(null);
    focusPicker();
  };
  const remove = (id: string, index: number) => {
    onChange(selected.filter((value) => value !== id));
    requestAnimationFrame(() => {
      const buttons = tableRef.current?.querySelectorAll<HTMLButtonElement>('[data-remove-type]');
      const next = buttons?.[Math.min(index, buttons.length - 1)];
      if (next) next.focus();
      else focusPicker();
    });
  };
  const pickerLabel = label ?? t('requisition-templates.configure.facility-type');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <PickerAdd>
          <Combobox
            items={items}
            itemToStringLabel={(item: TypeItem) => item.label}
            value={picked}
            onValueChange={(item: TypeItem | null) => setPickedId(item?.value ?? null)}
            disabled={disabled || !items.length}
          >
            <PickerAddField ref={pickerRef}>
              <ComboboxInput
                aria-label={pickerLabel}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                dir="auto"
                placeholder={placeholder ?? t('requisition-templates.form.pick-facility-type')}
                width="full"
              >
                <PickerAddIcon>
                  <Building2Icon />
                </PickerAddIcon>
              </ComboboxInput>
            </PickerAddField>
            <ComboboxContent anchor={pickerRef}>
              <ComboboxEmpty>{t('requisition-templates.form.no-types-left')}</ComboboxEmpty>
              <ComboboxList>
                {(item: TypeItem) => (
                  <ComboboxItem key={item.value} value={item}>
                    <bdi>{item.label}</bdi>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <PickerAddButton disabled={!picked} onClick={add}>
            {addLabel ?? t('requisition-templates.configure.add')}
          </PickerAddButton>
        </PickerAdd>
      </div>
      <div ref={tableRef}>
        <DataTableCard>
          <Table density="comfortable" layout="fixed">
            <TableHeader surface="muted">
              <TableRow>
                <TableHead>
                  <DataTableHeaderLabel>
                    {t('requisition-templates.configure.facility-type')}
                  </DataTableHeaderLabel>
                </TableHead>
                <TableHead width="icon">
                  <span className="sr-only">{t('requisition-templates.action')}</span>
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
                      <div className="flex">
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
                    <DataTableEmpty
                      icon={<Building2Icon />}
                      title={emptyTitle}
                      description={emptyDescription}
                    />
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
