import { Link, type LinkProps, useLocation } from '@tanstack/react-router';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkspaceFooter } from '@/components/workspace';

type WorkspaceTab = { to: NonNullable<LinkProps['to']>; label: string };

type WorkspaceTabsProps = {
  label: string;
  tabs: readonly WorkspaceTab[];
  children: ReactNode;
};

export function WorkspaceTabs({ label, tabs, children }: WorkspaceTabsProps) {
  const { pathname } = useLocation();
  const current = pathname.replace(/\/$/, '');
  const tab = tabs.find(({ to }) => to === current)?.to ?? tabs[0]?.to;

  return (
    <Tabs spacing="page" value={tab}>
      <div className="@container">
        <TabsList aria-label={label} wrap>
          {tabs.map((item) => (
            <TabsTrigger
              key={item.to}
              nativeButton={false}
              render={<Link to={item.to} />}
              value={item.to}
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value={tab}>{children}</TabsContent>
    </Tabs>
  );
}

const FooterSlot = createContext<HTMLElement | null>(null);

export function WorkspaceFooterScope({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <FooterSlot value={slot}>
      {children}
      <div className="contents" ref={setSlot} />
    </FooterSlot>
  );
}

export function WorkspaceFooterPortal({ children }: { children: ReactNode }) {
  const slot = useContext(FooterSlot);
  return slot
    ? createPortal(<WorkspaceFooter width="narrow">{children}</WorkspaceFooter>, slot)
    : null;
}
