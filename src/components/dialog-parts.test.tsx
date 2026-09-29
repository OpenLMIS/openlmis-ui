import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DialogLoadError } from '@/components/dialog-parts';
import { FormDialog } from '@/components/form-dialog/form-dialog';
import { httpError, networkError } from '@/tests/http-error';

const renderLoadError = (error: unknown) =>
  render(
    <FormDialog onOpenChange={() => {}} open>
      <DialogLoadError
        error={error}
        errorTitle="users.load-error"
        onRetry={vi.fn()}
        title="Edit User"
      />
    </FormDialog>,
  );

describe('DialogLoadError', () => {
  it('asks for a connection when the record could not be fetched offline', () => {
    renderLoadError(networkError());

    expect(screen.getByText('offline.notice-title')).toBeInTheDocument();
    expect(screen.getByText('offline.notice-description')).toBeInTheDocument();
  });

  it('keeps its own error for anything else', () => {
    renderLoadError(httpError(500));

    expect(screen.getByText('users.load-error')).toBeInTheDocument();
    expect(screen.getByText('error.check-connection')).toBeInTheDocument();
  });
});
