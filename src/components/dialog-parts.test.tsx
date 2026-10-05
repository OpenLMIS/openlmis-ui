import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DialogLoadError, FieldSkeleton, SwitchRowSkeleton } from '@/components/dialog-parts';
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

describe('loading placeholders', () => {
  it("keeps a field's label and help text while its value loads", () => {
    render(<FieldSkeleton description="Press Enter to add one." label="Tags" />);

    expect(screen.getByText('Tags')).toBeVisible();
    expect(screen.getByText('Press Enter to add one.')).toBeVisible();
  });

  it("keeps a switch's label while it loads", () => {
    render(<SwitchRowSkeleton label="Allow Free Text" />);

    expect(screen.getByText('Allow Free Text')).toBeVisible();
  });
});
