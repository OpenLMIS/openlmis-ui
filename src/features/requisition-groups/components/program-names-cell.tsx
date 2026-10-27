import { useTranslation } from 'react-i18next';
import { NamesPopover } from '@/components/names-popover';
import type { ProgramSchedule } from '@/features/reference-data/lib/types';

export function ProgramNamesCell({
  schedules,
  name,
}: {
  schedules: ProgramSchedule[];
  name: string;
}) {
  const { t } = useTranslation();
  if (schedules.length === 0) return null;
  if (schedules.length === 1) return <span dir="auto">{schedules[0]?.program.name}</span>;

  return (
    <NamesPopover
      label={t('requisition-groups.program-count-for', { count: schedules.length, name })}
      names={schedules.map(({ program }) => ({ id: program.id, name: program.name ?? '' }))}
      summary={t('requisition-groups.program-count', { count: schedules.length })}
    />
  );
}
