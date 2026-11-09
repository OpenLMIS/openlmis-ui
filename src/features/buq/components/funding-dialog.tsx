import { useStore } from '@tanstack/react-form';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DialogTable } from '@/components/display/dialog-table';
import { CellText } from '@/components/display/table-cards';
import { useAppForm } from '@/components/form/form';
import { SettingsItem, SettingsList } from '@/components/form/settings-list';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import {
  type FundingDraft,
  gapOf,
  OPTIONAL_FUNDING_AMOUNT,
  projectedTotal,
} from '@/features/buq/lib/forecast';
import { formatMoney } from '@/features/buq/lib/money';
import type { CurrencySettings } from '@/features/reference-data/lib/types';
import { useDialogCardLayout } from '@/hooks/use-card-view';

type FundingDialogProps = {
  open: boolean;
  onClose: () => void;
  rows: FundingDraft[];
  totalCost: number;
  currency: CurrencySettings;
  editable: boolean;
  onSave: (rows: FundingDraft[]) => void;
};

type FundingRow = FundingDraft & { index: number };

const helper = createColumnHelper<DataTableFeatures, FundingRow>();

export function FundingDialog({
  open,
  onClose,
  rows,
  totalCost,
  currency,
  editable,
  onSave,
}: FundingDialogProps) {
  const { t } = useTranslation();
  const { measure, cards } = useDialogCardLayout('2xl');
  const form = useAppForm({
    defaultValues: { funding: rows },
    onSubmit: ({ value }) => {
      onSave(value.funding);
      onClose();
    },
  });
  useEffect(() => {
    if (open) form.reset({ funding: rows });
  }, [open, form, rows]);
  const funding = useStore(form.store, (state) => state.values.funding);
  const data = useMemo(() => funding.map((row, index) => ({ ...row, index })), [funding]);
  const columns = useMemo(() => {
    const amount = (part: 'used' | 'projected', label: (source: string) => string) =>
      helper.display({
        id: part,
        header: t(`buq.forecast.funding-${part}-column`),
        cell: ({ row }) => (
          <form.AppField
            name={`funding[${row.original.index}].${part}`}
            validators={{ onChange: OPTIONAL_FUNDING_AMOUNT }}
          >
            {(field) => (
              <field.DecimalField
                disabled={!editable}
                label={label(row.original.name)}
                layout="inline"
              />
            )}
          </form.AppField>
        ),
        meta: { label: t(`buq.forecast.funding-${part}-column`), skeleton: 'control' },
      });
    return helper.columns([
      helper.display({
        id: 'source',
        header: t('buq.forecast.funding-source'),
        cell: ({ row }) => (
          <CellText overflow="clamp">
            <bdi>{row.original.name}</bdi>
          </CellText>
        ),
        meta: { label: t('buq.forecast.funding-source') },
      }),
      amount('used', (source) => t('buq.forecast.funding-used', { source })),
      amount('projected', (source) => t('buq.forecast.funding-projected', { source })),
    ]);
  }, [t, form, editable]);
  const table = useTable({ features: dataTableFeatures, data, columns });
  const totalProjectedFund = projectedTotal(funding);
  const money = (value: number) => formatMoney(value, currency);

  return (
    <FormDialog onOpenChange={(next) => !next && onClose()} open={open} size="2xl">
      <div className="flex min-h-0 flex-1 flex-col gap-4" ref={measure}>
        <FormDialogForm onSubmit={() => void form.handleSubmit()}>
          <FormDialogHeader>
            <FormDialogTitle>{t('buq.forecast.funding-title')}</FormDialogTitle>
          </FormDialogHeader>
          <FormDialogBody>
            <DialogTable
              cards={cards}
              density="compact"
              empty={<DataTableEmpty title={t('buq.forecast.funding-empty')} />}
              table={table}
              title="source"
            />
            <SettingsList density="compact">
              <SettingsItem label={t('buq.forecast.total-projected-fund')}>
                {money(totalProjectedFund)}
              </SettingsItem>
              <SettingsItem label={t('buq.forecast.total-forecasted-cost')}>
                {money(totalCost)}
              </SettingsItem>
              <SettingsItem label={t('buq.forecast.gap')}>
                <bdi dir="ltr">{money(gapOf(totalProjectedFund, totalCost))}</bdi>
              </SettingsItem>
            </SettingsList>
          </FormDialogBody>
          <FormDialogFooter>
            <FormDialogCancel>{t(editable ? 'dialog.cancel' : 'dialog.close')}</FormDialogCancel>
            {editable && <FormDialogSubmit>{t('buq.forecast.funding-save')}</FormDialogSubmit>}
          </FormDialogFooter>
        </FormDialogForm>
      </div>
    </FormDialog>
  );
}
