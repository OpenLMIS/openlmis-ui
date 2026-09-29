import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListError } from '@/components/list-error';
import { httpError, networkError } from '@/tests/http-error';

vi.mock('@/components/no-access-page', () => ({ NoAccess: () => <p>no-access</p> }));

const renderError = (error: unknown) =>
  render(<ListError description="list.error" error={error} reset={vi.fn()} title="list.title" />);

describe('ListError', () => {
  it('asks for a connection when the list could not be fetched offline', () => {
    renderError(networkError());

    expect(screen.getByText('offline.notice-title')).toBeInTheDocument();
    expect(screen.queryByText('list.title')).not.toBeInTheDocument();
  });

  it('keeps the list error for anything else', () => {
    renderError(httpError(500));

    expect(screen.getByText('list.title')).toBeInTheDocument();
    expect(screen.getByText('list.error')).toBeInTheDocument();
  });

  it('says No Access when the server refuses', () => {
    renderError(httpError(403));

    expect(screen.getByText('no-access')).toBeInTheDocument();
  });
});
