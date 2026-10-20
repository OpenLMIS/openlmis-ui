import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function NamesPopover({
  summary,
  label,
  names,
}: {
  summary: string;
  label?: string;
  names: { id: string; name: string }[];
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={<Button aria-label={label} align="start" padding="none" variant="ghost" />}
      >
        {summary}
      </PopoverTrigger>
      <PopoverContent align="start">
        <ul className="flex flex-col gap-2">
          {names.map(({ id, name }) => (
            <li dir="auto" key={id}>
              {name}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
