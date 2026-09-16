import { SearchXIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { MOCK_OWNERS, type ProjectOwner } from '@/features/new-project/lib/types';

export type OwnerComboboxProps = {
  id: string;
  value: string;
  onChange: (next: string) => void;
  ariaInvalid?: boolean;
};

export function OwnerCombobox({ id, value, onChange, ariaInvalid }: OwnerComboboxProps) {
  const selected = value ? (MOCK_OWNERS.find((owner) => owner.id === value) ?? null) : null;

  return (
    <Combobox
      items={MOCK_OWNERS}
      value={selected}
      onValueChange={(next: ProjectOwner | null) => onChange(next?.id ?? '')}
      itemToStringLabel={(item: ProjectOwner) => item.name}
      itemToStringValue={(item: ProjectOwner) => item.id}
    >
      <ComboboxInput
        id={id}
        placeholder="Search owners..."
        aria-invalid={ariaInvalid}
        showClear={Boolean(value)}
      />
      <ComboboxContent>
        <ComboboxList>
          <ComboboxCollection>
            {(item: ProjectOwner) => (
              <ComboboxItem key={item.id} value={item}>
                <Avatar className="size-6">
                  <AvatarImage src={item.avatarUrl} alt="" />
                  <AvatarFallback size="xs">{item.avatarFallback}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-medium text-foreground">{item.name}</span>
                  <span className="truncate text-2xs text-muted-foreground">{item.email}</span>
                </div>
              </ComboboxItem>
            )}
          </ComboboxCollection>
          <ComboboxEmpty>
            <div className="flex flex-col items-center gap-1 py-3 text-muted-foreground">
              <SearchXIcon className="size-5" aria-hidden="true" />
              <span className="text-xs">No owners match</span>
            </div>
          </ComboboxEmpty>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
