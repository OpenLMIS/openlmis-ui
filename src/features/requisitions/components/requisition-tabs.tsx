import { useSuspenseQueries } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { CircleAlertIcon } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requisitionGridQueries } from '@/features/requisitions/api/queries';
import { PatientsGrid } from '@/features/requisitions/components/patients-grid';
import type { GridEditing } from '@/features/requisitions/components/requisition-grid';
import {
  type GridSearch,
  RequisitionGridView,
} from '@/features/requisitions/components/requisition-grid';
import { RequisitionTotals } from '@/features/requisitions/components/requisition-totals';
import type { RequisitionEditor } from '@/features/requisitions/hooks/use-requisition-form';
import { calculateLine, calculateTotals } from '@/features/requisitions/lib/calculations';
import { applyRequisitionDraft } from '@/features/requisitions/lib/draft';
import type { RequisitionLine } from '@/features/requisitions/lib/lines';
import { buildLines } from '@/features/requisitions/lib/lines';
import { defaultRequisitionTab, type RequisitionTab } from '@/features/requisitions/lib/template';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { validateLine } from '@/features/requisitions/lib/validation';
import type { QuantityUnit } from '@/lib/quantity';
import type { SearchChange } from '@/lib/table-search';

export function RequisitionTabs({
  record,
  editor,
  editing,
  onAddProduct,
  tab,
  onTabChange,
  search,
  onSearchChange,
  onAdjustments,
  onCloseAdjustments,
  supplyingStock,
  unit,
  setUnit,
  canSwitch,
}: {
  record: RequisitionRecord;
  editor?: RequisitionEditor;
  editing?: GridEditing;
  onAddProduct?: () => void;
  tab?: RequisitionTab;
  search: GridSearch;
  onSearchChange: SearchChange<GridSearch>;
  onAdjustments: (id: string) => void;
  onCloseAdjustments: () => void;
  supplyingStock: boolean;
  unit: QuantityUnit;
  setUnit: (unit: QuantityUnit) => void;
  canSwitch: boolean;
  onTabChange: (value: RequisitionTab) => void;
}) {
  const { t } = useTranslation();
  const [
    { data: products },
    { data: approvedProducts },
    { data: period },
    { data: currency },
    { data: program },
  ] = useSuspenseQueries({ queries: requisitionGridQueries(record) });
  const draft = editor?.draft;
  const current = useMemo(
    () => (draft ? applyRequisitionDraft(record, draft) : record),
    [record, draft],
  );
  const cacheContext = useRef({
    record,
    months: period.durationInMonths,
    editable: editing?.editable,
  });
  const cache = useRef(
    new Map<
      string,
      { signature: string; model: RequisitionLine; errors: Record<string, ParseKeys> }
    >(),
  );
  const { models, totals, errors } = useMemo(() => {
    if (
      cacheContext.current.record !== record ||
      cacheContext.current.months !== period.durationInMonths ||
      cacheContext.current.editable !== editing?.editable
    ) {
      cache.current.clear();
      cacheContext.current = {
        record,
        months: period.durationInMonths,
        editable: editing?.editable,
      };
    }
    const next = new Map<
      string,
      { signature: string; model: RequisitionLine; errors: Record<string, ParseKeys> }
    >();
    const models = buildLines(current, products, approvedProducts).map((model) => {
      const signature = JSON.stringify(model);
      const previous = cache.current.get(model.line.id);
      const entry =
        previous?.signature === signature
          ? previous
          : {
              signature,
              model: { ...model, line: calculateLine(model, record, period.durationInMonths ?? 1) },
              errors: editing?.editable
                ? validateLine(model, record, period.durationInMonths ?? 1)
                : {},
            };
      next.set(model.line.id, entry);
      return entry.model;
    });
    cache.current = next;
    const errors = editing?.editable
      ? Object.fromEntries(
          [...next]
            .filter(([, entry]) => Object.keys(entry.errors).length)
            .map(([id, entry]) => [id, entry.errors]),
        )
      : {};
    return { models, totals: calculateTotals(models), errors };
  }, [record, current, products, approvedProducts, period.durationInMonths, editing?.editable]);
  const patients = record.template.patientsTabEnabled;
  const tabs: { value: RequisitionTab; label: string }[] = [
    ...(patients
      ? [{ value: 'patients' as const, label: t('requisitions.requisition.patients') }]
      : []),
    {
      value: 'fullSupply',
      label: t(
        patients ? 'requisitions.requisition.priority' : 'requisitions.requisition.full-supply',
      ),
    },
    ...(program.showNonFullSupplyTab
      ? [
          {
            value: 'nonFullSupply' as const,
            label: t(
              patients
                ? 'requisitions.requisition.additional'
                : 'requisitions.requisition.non-full-supply',
            ),
          },
        ]
      : []),
  ];
  const active = tabs.some(({ value }) => value === tab)
    ? tab
    : defaultRequisitionTab(record.template);
  return (
    <>
      <Tabs
        spacing="page"
        value={active}
        onValueChange={(value) => onTabChange(value as RequisitionTab)}
      >
        <TabsList size="lg" wrap="column" aria-label={t('requisitions.requisition.tabs')}>
          {tabs.map(({ value, label }) => (
            <TabsTrigger key={value} value={value}>
              {label}
              {models.some(
                (model) =>
                  (value === 'fullSupply'
                    ? model.fullSupply
                    : value === 'nonFullSupply' && !model.fullSupply) && errors[model.line.id],
              ) && (
                <CircleAlertIcon
                  className="size-4 text-destructive"
                  aria-label={t('requisitions.edit.invalid-lines')}
                />
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(({ value }) => (
          <TabsContent key={value} value={value}>
            {value === 'patients' ? (
              <PatientsGrid patientsData={record.patientsData} />
            ) : (
              <RequisitionGridView
                key={`${record.id}:${record.template.id ?? 'template'}`}
                record={current}
                editing={editing}
                errors={errors}
                onAddProduct={onAddProduct}
                models={models}
                totals={totals}
                currency={currency}
                tab={value}
                search={search}
                onSearchChange={onSearchChange}
                onAdjustments={onAdjustments}
                onCloseAdjustments={onCloseAdjustments}
                unit={unit}
                setUnit={setUnit}
                canSwitch={canSwitch}
                supplyingStock={supplyingStock}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
      <RequisitionTotals
        totals={totals}
        currency={currency}
        showNonFullSupply={!!program.showNonFullSupplyTab}
      />
    </>
  );
}
