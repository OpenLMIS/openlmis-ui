import { useStore } from '@tanstack/react-form';
import { useSuspenseQueries } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { CircleAlertIcon } from 'lucide-react';
import { type ComponentProps, useMemo, useRef } from 'react';
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
import {
  applyRequisitionDraft,
  canSkipLine,
  type LineDraft,
  type RequisitionDraft,
} from '@/features/requisitions/lib/draft';
import type { RequisitionLine } from '@/features/requisitions/lib/lines';
import { buildLines } from '@/features/requisitions/lib/lines';
import { defaultRequisitionTab, type RequisitionTab } from '@/features/requisitions/lib/template';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { validateLine } from '@/features/requisitions/lib/validation';
import type { QuantityUnit } from '@/lib/quantity';
import type { SearchChange } from '@/lib/table-search';

type LineCacheEntry = {
  source: RequisitionLine['line'] | undefined;
  changes?: LineDraft;
  model: RequisitionLine & { canSkip: boolean };
  errors: Record<string, ParseKeys>;
};
function RequisitionTabsView({
  record,
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
  draft,
  showAllErrors,
}: {
  draft?: RequisitionDraft;
  showAllErrors?: boolean;
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
  const current = useMemo(
    () => (draft ? applyRequisitionDraft(record, draft) : record),
    [record, draft],
  );
  const cacheContext = useRef({
    record,
    months: period.durationInMonths,
    editable: editing?.editable,
  });
  const sources = useMemo(
    () => new Map(record.requisitionLineItems.map((line) => [line.id, line])),
    [record],
  );
  const cache = useRef(new Map<string, LineCacheEntry>());
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
    const next = new Map<string, LineCacheEntry>();
    const models = buildLines(current, products, approvedProducts).map((model) => {
      const source = sources.get(model.line.id);
      const changes = draft?.lines[model.line.id];
      const previous = cache.current.get(model.line.id);
      let entry = previous;
      if (
        !entry ||
        entry.source !== source ||
        entry.changes !== changes ||
        entry.model.product !== model.product ||
        entry.model.approvedProduct !== model.approvedProduct
      ) {
        const line = calculateLine(model, record, period.durationInMonths ?? 1);
        const errors: Record<string, ParseKeys> = editing?.editable
          ? validateLine(model, record, period.durationInMonths ?? 1, changes)
          : {};
        entry = {
          source,
          changes,
          model: {
            ...model,
            line,
            canSkip: canSkipLine({ ...line, ...changes }, record.template, {
              tab: model.fullSupply ? 'fullSupply' : 'nonFullSupply',
              status: record.status,
              emergency: record.emergency,
            }),
          },
          errors,
        };
      }
      next.set(model.line.id, entry);
      return entry.model;
    });
    cache.current = next;
    const errors = editing?.editable
      ? Object.fromEntries(
          [...next]
            .filter(
              ([id, entry]) =>
                (showAllErrors || draft?.lines[id]) && Object.keys(entry.errors).length,
            )
            .map(([id, entry]) => [id, entry.errors]),
        )
      : {};
    return { models, totals: calculateTotals(models), errors };
  }, [
    record,
    sources,
    current,
    products,
    approvedProducts,
    period.durationInMonths,
    editing?.editable,
    showAllErrors,
    draft,
  ]);
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
                record={record}
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

type TabsProps = Omit<ComponentProps<typeof RequisitionTabsView>, 'draft' | 'showAllErrors'>;
export function RequisitionTabs(props: TabsProps) {
  return props.editor ? (
    <RequisitionDraftTabs {...props} editor={props.editor} />
  ) : (
    <RequisitionTabsView {...props} />
  );
}
function RequisitionDraftTabs(props: TabsProps & { editor: RequisitionEditor }) {
  const draft = useStore(props.editor.form.store, (state) => state.values.draft);
  const showAllErrors = useStore(props.editor.form.store, (state) => state.values.showAllErrors);
  return <RequisitionTabsView {...props} draft={draft} showAllErrors={showAllErrors} />;
}
