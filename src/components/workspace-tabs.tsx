import {
  type HistoryState,
  Link,
  type LinkProps,
  useLocation,
  useRouter,
} from '@tanstack/react-router';
import { type ComponentProps, createContext, type ReactNode, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkspaceActions, WorkspaceFooter } from '@/components/workspace';

type WorkspaceTab = {
  to: NonNullable<LinkProps['to']>;
  params?: Record<string, string>;
  label: string;
};

type WorkspaceTabsProps = {
  label: string;
  tabs: readonly WorkspaceTab[];
  linkState?: HistoryState;
  wrap?: 'column' | 'grid';
  children: ReactNode;
};

export function WorkspaceTabs({
  label,
  tabs,
  linkState,
  wrap = 'column',
  children,
}: WorkspaceTabsProps) {
  const router = useRouter();
  const { pathname } = useLocation();
  const current = pathname.replace(/\/$/, '');
  const tab =
    tabs.find(
      (item) =>
        router.buildLocation({ to: item.to, params: item.params } as never).pathname === current,
    )?.to ?? tabs[0]?.to;

  return (
    <Tabs spacing="page" value={tab}>
      <div className="@container">
        <TabsList aria-label={label} wrap={wrap === 'grid' ? true : 'column'}>
          {tabs.map((item) => (
            <TabsTrigger
              key={item.to}
              nativeButton={false}
              render={<Link params={item.params as never} state={linkState} to={item.to} />}
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

type Slots = {
  footer: HTMLElement | null;
  actions: HTMLElement | null;
  setActions: (element: HTMLElement | null) => void;
};

const SlotsContext = createContext<Slots>({ footer: null, actions: null, setActions: () => {} });

export function WorkspaceSlots({ children }: { children: ReactNode }) {
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  const [actions, setActions] = useState<HTMLElement | null>(null);
  return (
    <SlotsContext value={{ footer, actions, setActions }}>
      {children}
      <div className="contents" ref={setFooter} />
    </SlotsContext>
  );
}

export function WorkspaceActionsSlot() {
  const { setActions } = useContext(SlotsContext);
  return <div className="contents" ref={setActions} />;
}

export function WorkspaceActionsPortal({ children }: { children: ReactNode }) {
  const { actions } = useContext(SlotsContext);
  return actions ? createPortal(<WorkspaceActions>{children}</WorkspaceActions>, actions) : null;
}

type WorkspaceFooterPortalProps = {
  children: ReactNode;
  width?: ComponentProps<typeof WorkspaceFooter>['width'];
};

export function WorkspaceFooterPortal({ children, width = 'narrow' }: WorkspaceFooterPortalProps) {
  const { footer } = useContext(SlotsContext);
  return footer
    ? createPortal(<WorkspaceFooter width={width}>{children}</WorkspaceFooter>, footer)
    : null;
}
