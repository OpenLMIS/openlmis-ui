import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { programLookupOptions } from '@/features/reference-data/api/queries';
import { RequisitionGridPending } from '@/features/requisitions/components/requisition-skeletons';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

export type RequisitionTab = 'fullSupply' | 'nonFullSupply' | 'patients';
export function RequisitionTabs({
  record,
  tab,
  onTabChange,
}: {
  record: RequisitionRecord;
  tab?: RequisitionTab;
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
          <RequisitionGridPending />
        </TabsContent>
      ))}
    </Tabs>
  );
}
