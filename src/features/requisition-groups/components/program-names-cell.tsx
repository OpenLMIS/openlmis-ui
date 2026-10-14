import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ProgramSchedule } from '@/features/requisition-groups/lib/types';

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
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label={t('requisition-groups.program-count-for', {
              count: schedules.length,
              name,
            })}
            align="start"
            padding="none"
            variant="ghost"
          />
        }
      >
        {t('requisition-groups.program-count', { count: schedules.length })}
      </PopoverTrigger>
      <PopoverContent align="start">
        <ul className="flex flex-col gap-2">
          {schedules.map(({ program }) => (
            <li dir="auto" key={program.id}>
              {program.name}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
