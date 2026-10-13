import { type ReactNode, useContext } from 'react';
import { AppShell, AppShellContext } from '@/components/app-shell';
import { Empty } from '@/components/ui/empty';
import { useLoginData } from '@/features/auth/store/login-data';

export function StatusPage({ children }: { children: ReactNode }) {
  const inShell = useContext(AppShellContext);
  const signedIn = useLoginData((state) => Boolean(state.accessToken));

  if (inShell) return <Empty>{children}</Empty>;
  if (!signedIn) return <Empty height="screen">{children}</Empty>;

  return (
    <AppShell>
      <Empty>{children}</Empty>
    </AppShell>
  );
}
