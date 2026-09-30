import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RouteLoadError } from '@/components/route-load-error';
import { httpError, networkError } from '@/tests/http-error';

vi.mock('@/components/no-access-page', () => ({ NoAccessPage: () => <p>no-access</p> }));
vi.mock('@/components/workspace', () => ({
  Workspace: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  WorkspaceContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const steps: string[] = [];
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useRouter: () => ({ invalidate: () => steps.push('invalidate') }),
}));

const reset = () => steps.push('reset');
const renderError = (error: unknown) =>
  render(
    <RouteLoadError
      description="Could not load this page."
      error={error as Error}
      info={undefined}
      reset={reset}
      title="Page Not Loaded"
    />,
  );

describe('RouteLoadError', () => {
  it('asks for a connection when the page could not load offline', () => {
    renderError(networkError());

    expect(screen.getByRole('heading', { name: 'offline.notice-title' })).toBeInTheDocument();
    expect(screen.queryByText('Page Not Loaded')).not.toBeInTheDocument();
  });

  it('shows No Access for a refusal', () => {
    renderError(httpError(403));

    expect(screen.getByText('no-access')).toBeInTheDocument();
  });

  it('runs the loaders again before it resets, so Try Again loads the page', async () => {
    steps.length = 0;
    renderError(httpError(500));
    expect(screen.getByText('Page Not Loaded')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(steps).toEqual(['invalidate', 'reset']);
  });
});
