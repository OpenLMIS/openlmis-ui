import { useNavigate } from '@tanstack/react-router';
import type { ParseKeys } from 'i18next';
import { type LucideIcon, SearchIcon } from 'lucide-react';
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
import { isNavParent, LIVE_NAV_ITEMS } from '@/lib/config';
import type { LiveNavLink } from '@/lib/types';

type PaletteSection = {
  headingKey?: ParseKeys;
  icon?: LucideIcon;
  links: LiveNavLink[];
};

// Top-level links share one unlabelled section; each parent becomes a section headed by its title.
const SECTIONS: PaletteSection[] = [
  { links: LIVE_NAV_ITEMS.filter((item): item is LiveNavLink => !isNavParent(item)) },
  ...LIVE_NAV_ITEMS.filter(isNavParent).map((parent) => ({
    headingKey: parent.titleKey,
    ...(parent.icon && { icon: parent.icon }),
    links: parent.items,
  })),
].filter((section) => section.links.length > 0);

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
            {SECTIONS.map((section) => {
              const heading = section.headingKey && t(section.headingKey);
              return (
                <CommandGroup heading={heading} key={section.headingKey ?? 'top-level'}>
                  {section.links.map((link) => {
                    const title = t(link.titleKey);
                    return (
                      <CommandItem
                        key={link.titleKey}
                        onSelect={() => {
                          setOpen(false);
                          navigate({ to: link.to });
                        }}
                        value={heading ? `${heading} ${title}` : title}
                      >
                        {link.icon ? <link.icon /> : section.icon && <section.icon />}
                        <span>{title}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
