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
import { isNavParent, NAV_ITEMS } from '@/lib/config';
import type { NavItem, NavLink } from '@/lib/types';

type RoutedNavLink = NavLink & { to: Exclude<NavLink['to'], '#'> };

type PaletteSection = {
  headingKey?: ParseKeys;
  icon?: LucideIcon;
  links: RoutedNavLink[];
};

const isRouted = (link: NavLink): link is RoutedNavLink => link.to !== '#';

// Top-level links share one unlabelled section; each parent becomes a section headed by its title.
const toSections = (items: NavItem[]): PaletteSection[] => [
  { links: items.filter((item): item is NavLink => !isNavParent(item)).filter(isRouted) },
  ...items.filter(isNavParent).map((parent) => ({
    headingKey: parent.titleKey,
    ...(parent.icon && { icon: parent.icon }),
    links: parent.items.filter(isRouted),
  })),
];

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
  const sections = toSections(NAV_ITEMS).filter((section) => section.links.length > 0);

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
            {sections.map((section) => {
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
