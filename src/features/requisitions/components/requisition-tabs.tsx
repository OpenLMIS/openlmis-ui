import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { programLookupOptions } from '@/features/reference-data/api/queries';
import { PatientsGrid } from '@/features/requisitions/components/patients-grid';
import {
  type GridSearch,
  RequisitionGrid,
} from '@/features/requisitions/components/requisition-grid';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import type { QuantityUnit } from '@/lib/quantity';
import type { SearchChange } from '@/lib/table-search';

export type RequisitionTab = 'fullSupply' | 'nonFullSupply' | 'patients';
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
  const { data: program } = useSuspenseQuery(programLookupOptions(record.program.id));
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
    : patients
      ? 'patients'
      : 'fullSupply';
  return (
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
            <RequisitionGrid
              key={`${record.id}:${(record.template as { id?: string }).id ?? 'template'}`}
              record={record}
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
  );
}
