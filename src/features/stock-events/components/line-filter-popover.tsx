import { FilterIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Props = { keyword: string; disabled: boolean; onSearch: (keyword: string) => void };
export function LineFilterPopover({ keyword, disabled, onSearch }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(keyword);
  const search = () => {
    onSearch(draft.trim());
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(keyword);
        setOpen(next);
      }}
    >
      <PopoverTrigger render={<Button disabled={disabled} type="button" variant="outline" />}>
        <FilterIcon data-icon="inline-start" />
        {t('stock-events.filter')}
        {keyword.trim() && <Badge variant="secondary">1</Badge>}
      </PopoverTrigger>
      <PopoverContent align="start">
        <Field>
          <FieldLabel htmlFor={id}>{t('stock-events.keywords')}</FieldLabel>
          <Input
            id={id}
            maxLength={50}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                search();
              }
            }}
          />
        </Field>
        <div className="flex justify-between gap-2">
          <Button onClick={() => setOpen(false)} type="button" variant="outline">
            {t('stock-events.cancel')}
          </Button>
          <Button onClick={search} type="button">
            {t('stock-events.search')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
