import { cleanup, render, screen } from '@testing-library/react';
import { createContext, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/app-shell';
import { StatusPage } from '@/components/status-page';
import { useLoginData } from '@/features/auth/store/login-data';

vi.mock('@/components/app-shell', () => {
  const AppShellContext = createContext(false);
  return {
    AppShellContext,
    AppShell: ({ children }: { children: ReactNode }) => (
      <AppShellContext value={true}>
        <div data-testid="shell">{children}</div>
      </AppShellContext>
    ),
  };
});

afterEach(() => {
  cleanup();
  useLoginData.getState().clearLoginData();
});

describe('StatusPage', () => {
  it('uses the screen height outside a signed-in shell', () => {
    const { container } = render(<StatusPage>Failure</StatusPage>);

    expect(container.querySelector('[data-slot="empty"]')).toHaveClass('h-screen');
    expect(screen.queryByTestId('shell')).not.toBeInTheDocument();
  });

  it('provides one shell for a signed-in root failure and reuses an existing shell', () => {
    useLoginData.getState().setLoginData({
      accessToken: 'token',
      referenceDataUserId: 'user',
      username: 'user',
    });
    const { container, rerender } = render(<StatusPage>Failure</StatusPage>);

    expect(screen.getAllByTestId('shell')).toHaveLength(1);
    expect(container.querySelector('[data-slot="empty"]')).not.toHaveClass('h-screen');

    rerender(
      <AppShell>
        <StatusPage>Failure</StatusPage>
      </AppShell>,
    );

    expect(screen.getAllByTestId('shell')).toHaveLength(1);
    expect(container.querySelector('[data-slot="empty"]')).not.toHaveClass('h-screen');
  });
});
