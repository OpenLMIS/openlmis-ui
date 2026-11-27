import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { DeleteRecordDialog } from '@/components/display/delete-record-dialog';
import { useLoginData } from '@/features/auth/store/login-data';

const record = { id: 'one', name: 'First' };

afterEach(() => {
  useLoginData.getState().clearLoginData();
  localStorage.clear();
});

function renderDelete({
  blocked,
  error,
}: {
  blocked?: () => { title: string; description: string };
  error?: Error;
}) {
  const client = new QueryClient();
  const onClose = vi.fn();
  const removeRecord = vi.fn(async () => {
    if (error) throw error;
  });
  const refresh = vi.fn(async () => {});
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'admin',
    username: 'ada',
    accessToken: 'token',
  });
  render(
    <QueryClientProvider client={client}>
      <DeleteRecordDialog
        addButton={{ current: null }}
        opener={{ current: null }}
        target={record.id}
        hint={record}
        onClose={onClose}
        blocked={blocked}
        detailOptions={(id, opening) =>
          queryOptions({ queryKey: ['record', id, opening], queryFn: async () => record })
        }
        removeRecord={removeRecord}
        refresh={refresh}
        refreshOnError={(failure) => failure === error}
        getCopy={() => ({
          action: 'Delete record',
          title: 'Delete record?',
          description: (name) => `Delete ${name}?`,
          pendingTitle: 'Loading record',
          missingTitle: 'Missing record',
          missingDescription: 'This record is missing.',
          loadErrorTitle: 'Could not load record',
          noAccessTitle: 'No access',
          noAccess: 'Access refused.',
          deleted: 'Record deleted',
          deletedDescription: (name) => `Deleted ${name}.`,
          errorTitle: 'Could not delete record',
        })}
      />
    </QueryClientProvider>,
  );
  return { onClose, refresh, removeRecord };
}

it('offers only Close for a blocked record', async () => {
  const user = userEvent.setup();
  const { onClose, removeRecord } = renderDelete({
    blocked: () => ({ title: 'Read-only record', description: 'This record is protected.' }),
  });
  expect(screen.getByRole('alertdialog', { name: 'Read-only record' })).toBeVisible();
  expect(screen.getByText('This record is protected.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Delete record' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'dialog.close' }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(removeRecord).not.toHaveBeenCalled();
});

it('refreshes and closes after a failure selected by the caller', async () => {
  const user = userEvent.setup();
  const { onClose, refresh } = renderDelete({ error: new Error('Delete failed') });
  await user.click(screen.getByRole('button', { name: 'Delete record' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(refresh).toHaveBeenCalledOnce();
});
