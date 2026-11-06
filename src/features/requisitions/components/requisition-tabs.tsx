import { useStore } from '@tanstack/react-form';
import { useSuspenseQueries } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { CircleAlertIcon } from 'lucide-react';
import { type ComponentProps, memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requisitionGridQueries } from '@/features/requisitions/api/queries';
import { PatientsGrid } from '@/features/requisitions/components/patients-grid';
import { RequisitionCopyBadge } from '@/features/requisitions/components/requisition-copy-notice';
import { RequisitionDraftStatus } from '@/features/requisitions/components/requisition-draft-status';
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
import {
  applyPatientChanges,
  parsePatients,
  patientsForProduct,
  validatePatients,
} from '@/features/requisitions/lib/patients';
import { defaultRequisitionTab, type RequisitionTab } from '@/features/requisitions/lib/template';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { validateLine } from '@/features/requisitions/lib/validation';
import { useCardLayout } from '@/hooks/use-card-view';
import type { QuantityUnit } from '@/lib/quantity';
import type { SearchChange } from '@/lib/table-search';

type LineCacheEntry = {
  source: RequisitionLine['line'] | undefined;
  changes?: LineDraft;
  patientTotal?: number;
  model: RequisitionLine & { canSkip: boolean };
  errors: Record<string, ParseKeys>;
};
const RequisitionTabsView = memo(function RequisitionTabsView({
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
  editor,
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
  const layout = useCardLayout<HTMLDivElement>();
  const showDraft = editing?.editable && editor?.device.deviceAvailable;
  const [
    { data: products },
    { data: approvedProducts },
    { data: period },
    { data: currency },
    { data: program },
  ] = useSuspenseQueries({ queries: requisitionGridQueries(record) });
  const basePatients = useMemo(() => parsePatients(record.patientsData), [record.patientsData]);
  const patientData = useMemo(
    () => applyPatientChanges(basePatients, draft?.patients),
    [basePatients, draft?.patients],
  );
  const current = useMemo(
    () => (draft ? applyRequisitionDraft(record, draft, basePatients) : record),
    [record, draft, basePatients],
  );
  const patientErrors = editing?.patientsEditable
    ? validatePatients(patientData, showAllErrors, true)
    : {};
  const cacheContext = useRef({
    record,
    months: period.durationInMonths,
    editable: editing?.editable,
    approver: editing?.approver,
    columns: editing?.editableColumns,
  });
  const sources = useMemo(
    () => new Map(record.requisitionLineItems.map((line) => [line.id, line])),
    [record],
  );
  const cache = useRef(new Map<string, LineCacheEntry>());
  const baseModels = useMemo(() => {
    const removed = new Set(draft?.removedLineIds);
    const saved = record.requisitionLineItems.filter((line) => !removed.has(line.id));
    const productsInRecord = new Set(saved.map((line) => line.orderable.id));
    const added = (draft?.addedLines ?? []).filter(
      (line) => !removed.has(line.id) && !productsInRecord.has(line.orderable.id),
    );
    return buildLines(
      { ...record, requisitionLineItems: [...saved, ...added] },
      products,
      approvedProducts,
    );
  }, [record, products, approvedProducts, draft?.addedLines, draft?.removedLineIds]);
  const currentLines = useMemo(
    () => new Map(current.requisitionLineItems.map((line) => [line.id, line])),
    [current],
  );
  const { models, totals, errors } = useMemo(() => {
    if (
      cacheContext.current.record !== record ||
      cacheContext.current.months !== period.durationInMonths ||
      cacheContext.current.editable !== editing?.editable ||
      cacheContext.current.approver !== editing?.approver ||
      cacheContext.current.columns !== editing?.editableColumns
    ) {
      cache.current.clear();
      cacheContext.current = {
        record,
        months: period.durationInMonths,
        editable: editing?.editable,
        approver: editing?.approver,
        columns: editing?.editableColumns,
      };
    }
    const next = new Map<string, LineCacheEntry>();
    const models = baseModels
      .filter((base) => currentLines.has(base.line.id))
      .map((base) => {
        const model = { ...base, line: currentLines.get(base.line.id) ?? base.line };
        const source = sources.get(model.line.id);
        const changes = draft?.lines[model.line.id];
        const patientTotal =
          record.template.columnsMap.numberOfPatientsOnTreatmentNextMonth?.source === 'CALCULATED'
            ? patientsForProduct(patientData, model.product?.productCode ?? '')
            : undefined;
        const previous = cache.current.get(model.line.id);
        let entry = previous;
        if (
          !entry ||
          entry.source !== source ||
          entry.changes !== changes ||
          entry.patientTotal !== patientTotal ||
          entry.model.product !== model.product ||
          entry.model.approvedProduct !== model.approvedProduct
        ) {
          const line = calculateLine(model, record, period.durationInMonths ?? 1, patientData);
          const errors: Record<string, ParseKeys> = editing?.editable
            ? validateLine(
                model,
                current,
                period.durationInMonths ?? 1,
                changes,
                editing.approver ? editing.editableColumns : undefined,
                patientData,
                line,
              )
            : {};
          entry = {
            source,
            changes,
            patientTotal,
            model: {
              ...model,
              line,
              canSkip: canSkipLine({ ...line, ...changes }, record.template, {
                tab: model.fullSupply ? 'fullSupply' : 'nonFullSupply',
                status: record.status,
                emergency: record.emergency,
              }),
            },
            errors:
              previous && JSON.stringify(previous.errors) === JSON.stringify(errors)
                ? previous.errors
                : errors,
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
    baseModels,
    currentLines,
    sources,
    current,
    period.durationInMonths,
    editing?.editable,
    editing?.editableColumns,
    editing?.approver,
    showAllErrors,
    draft,
    patientData,
  ]);
  const liveEditing = useMemo(
    () =>
      editing?.approver
        ? {
            ...editing,
            calculation: { record, months: period.durationInMonths ?? 1, patients: patientData },
          }
        : editing,
    [editing, record, period.durationInMonths, patientData],
  );
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
        ref={layout.measure}
        spacing="page"
        value={active}
        onValueChange={(value) => onTabChange(value as RequisitionTab)}
      >
        <TabsList size="lg" wrap="column" aria-label={t('requisitions.requisition.tabs')}>
          {tabs.map(({ value, label }) => (
            <TabsTrigger key={value} value={value}>
              {label}
              {(value === 'patients'
                ? Object.keys(patientErrors).length > 0
                : models.some(
                    (model) =>
                      (value === 'fullSupply'
                        ? model.fullSupply
                        : value === 'nonFullSupply' && !model.fullSupply) && errors[model.line.id],
                  )) && (
                <CircleAlertIcon
                  className="size-4 text-destructive"
                  aria-label={t('requisitions.edit.invalid-lines')}
                />
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {(layout.cards || active === 'patients') && (
          <div className="flex flex-wrap items-center justify-end gap-2 empty:hidden">
            {showDraft && editor ? (
              <RequisitionDraftStatus editor={editor} />
            ) : (
              <RequisitionCopyBadge />
            )}
          </div>
        )}
        {tabs.map(({ value }) => (
          <TabsContent key={value} value={value}>
            {value === 'patients' ? (
              <PatientsGrid
                patients={basePatients}
                editor={editing?.patientsEditable ? editor : undefined}
                pending={editing?.pending}
              />
            ) : (
              <RequisitionGridView
                key={`${record.id}:${record.template.id ?? 'template'}`}
                record={record}
                editing={liveEditing}
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
});

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
  const [deferred, setDeferred] = useState(draft);
  const approver = props.editing?.approver;
  useEffect(() => {
    if (!approver) return;
    let second: number | undefined;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setDeferred(draft));
    });
    return () => {
      cancelAnimationFrame(first);
      if (second !== undefined) cancelAnimationFrame(second);
    };
  }, [draft, approver]);
  return (
    <RequisitionTabsView
      {...props}
      draft={props.editing?.approver ? deferred : draft}
      showAllErrors={showAllErrors}
    />
  );
}
