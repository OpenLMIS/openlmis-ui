import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ProgramSchedule } from '@/features/requisition-groups/lib/types';

export function ProgramNamesCell({ schedules }: { schedules: ProgramSchedule[] }) {
  const { t } = useTranslation();
  if (schedules.length === 0) return null;
  if (schedules.length === 1) return schedules[0]?.program.name ?? null;

  return (
    <Popover>
      <PopoverTrigger render={<Button size="sm" variant="ghost" />}>
        {t('requisition-groups.program-count', { count: schedules.length })}
      </PopoverTrigger>
      <PopoverContent align="start">
        <ul className="flex flex-col gap-2">
          {schedules.map(({ id, program, processingSchedule }) => (
            <li dir="auto" key={id ?? `${program.id}:${processingSchedule.id}`}>
              {program.name}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
