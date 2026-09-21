import { useNavigate } from '@tanstack/react-router';
import { SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { NAV_GROUPS } from '@/lib/config';
import type { NavItem } from '@/lib/types';

type RoutedNavItem = NavItem & { to: Exclude<NavItem['to'], '#'> };

const isRouted = (item: NavItem): item is RoutedNavItem => item.to !== '#';

export function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((isOpen) => !isOpen);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Placeholder nav entries (`to: '#'`) have nowhere to navigate, so they stay out.
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(isRouted),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <button
        className="hidden h-8 w-56 items-center gap-2 rounded-md border border-border bg-muted/60 px-3 text-muted-foreground text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50 sm:inline-flex"
        onClick={() => setOpen(true)}
        type="button"
      >
        <SearchIcon className="size-4 shrink-0" />
        <span className="flex-1 text-start">{t('command.search')}</span>
        <KbdGroup>
          <Kbd size="sm">Ctrl</Kbd>
          <Kbd size="sm">K</Kbd>
        </KbdGroup>
      </button>

      <CommandDialog
        description={t('command.placeholder')}
        onOpenChange={setOpen}
        open={open}
        title={t('command.title')}
      >
        <Command>
          <CommandInput placeholder={t('command.placeholder')} />
          <CommandList>
            <CommandEmpty>{t('command.empty')}</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup heading={t(group.labelKey)} key={group.labelKey}>
                {group.items.map((item) => {
                  const title = t(item.titleKey);
                  return (
                    <CommandItem
                      key={`${group.labelKey}-${item.titleKey}`}
                      onSelect={() => {
                        setOpen(false);
                        navigate({ to: item.to });
                      }}
                      value={title}
                    >
                      {item.icon && <item.icon />}
                      <span>{title}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
