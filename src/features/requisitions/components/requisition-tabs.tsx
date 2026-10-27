import { useSuspenseQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requisitionGridQueries } from '@/features/requisitions/api/queries';
import { PatientsGrid } from '@/features/requisitions/components/patients-grid';
import {
  type GridSearch,
  RequisitionGridView,
} from '@/features/requisitions/components/requisition-grid';
import { RequisitionTotals } from '@/features/requisitions/components/requisition-totals';
import { calculateLine, calculateTotals } from '@/features/requisitions/lib/calculations';
import { buildLines } from '@/features/requisitions/lib/lines';
import { defaultRequisitionTab, type RequisitionTab } from '@/features/requisitions/lib/template';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import type { QuantityUnit } from '@/lib/quantity';
import type { SearchChange } from '@/lib/table-search';

export function RequisitionTabs({
  record,
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
  const { models, totals } = useMemo(() => {
    const models = buildLines(record, products, approvedProducts).map((model) => ({
      ...model,
      line: calculateLine(model, record, period.durationInMonths ?? 1),
    }));
    return { models, totals: calculateTotals(models) };
  }, [record, products, approvedProducts, period.durationInMonths]);
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
