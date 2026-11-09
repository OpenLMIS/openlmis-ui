import { useStore } from '@tanstack/react-form';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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

type FundingDialogProps = {
  open: boolean;
  onClose: () => void;
  rows: FundingDraft[];
  totalCost: number;
  currency: CurrencySettings;
  editable: boolean;
  onSave: (rows: FundingDraft[]) => void;
};

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
  const totalProjectedFund = projectedTotal(funding);
  const money = (value: number) => formatMoney(value, currency);

  return (
    <FormDialog onOpenChange={(next) => !next && onClose()} open={open} size="table">
      <FormDialogForm onSubmit={() => void form.handleSubmit()}>
        <FormDialogHeader>
          <FormDialogTitle>{t('buq.forecast.funding-title')}</FormDialogTitle>
        </FormDialogHeader>
        <FormDialogBody>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 items-end gap-3 font-medium text-muted-foreground text-xs">
              <span>{t('buq.forecast.funding-source')}</span>
              <span>{t('buq.forecast.funding-used-column')}</span>
              <span>{t('buq.forecast.funding-projected-column')}</span>
            </div>
            {funding.map((row, index) => (
              <div className="grid grid-cols-3 items-center gap-3" key={row.sourceId}>
                <span className="text-sm">
                  <bdi>{row.name}</bdi>
                </span>
                <form.AppField
                  name={`funding[${index}].used`}
                  validators={{ onChange: OPTIONAL_FUNDING_AMOUNT }}
                >
                  {(field) => (
                    <field.DecimalField
                      disabled={!editable}
                      label={t('buq.forecast.funding-used', { source: row.name })}
                      layout="inline"
                    />
                  )}
                </form.AppField>
                <form.AppField
                  name={`funding[${index}].projected`}
                  validators={{ onChange: OPTIONAL_FUNDING_AMOUNT }}
                >
                  {(field) => (
                    <field.DecimalField
                      disabled={!editable}
                      label={t('buq.forecast.funding-projected', { source: row.name })}
                      layout="inline"
                    />
                  )}
                </form.AppField>
              </div>
            ))}
          </div>
          <SettingsList density="compact">
            <SettingsItem label={t('buq.forecast.total-projected-fund')}>
              {money(totalProjectedFund)}
            </SettingsItem>
            <SettingsItem label={t('buq.forecast.total-forecasted-cost')}>
              {money(totalCost)}
            </SettingsItem>
            <SettingsItem label={t('buq.forecast.gap')}>
              {money(gapOf(totalProjectedFund, totalCost))}
            </SettingsItem>
          </SettingsList>
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel>{t(editable ? 'dialog.cancel' : 'dialog.close')}</FormDialogCancel>
          {editable && <FormDialogSubmit>{t('buq.forecast.funding-save')}</FormDialogSubmit>}
        </FormDialogFooter>
      </FormDialogForm>
    </FormDialog>
  );
}
