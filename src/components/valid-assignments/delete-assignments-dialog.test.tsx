import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteAssignmentsDialog } from '@/components/valid-assignments/delete-assignments-dialog';
import type { Picked } from '@/components/valid-assignments/selection';
import type { AssignmentsApi } from '@/components/valid-assignments/types';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const remove = vi.fn();
const api: AssignmentsApi = {
  kind: 'destinations',
  queryKey: ['validDestinations'],
  listOptions: vi.fn(),
  create: vi.fn(),
  remove,
};

const two: Picked = new Map([
  ['a', 'Balaka'],
  ['b', 'CHW'],
]);

function Harness({ onDeleted }: { onDeleted: (ids: string[]) => void }) {
  const [targets, setTargets] = useState<Picked>();
  const [gone, setGone] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  return (
    <>
      {!gone && (
        <button onClick={() => setTargets(two)} type="button">
          Delete Selected
        </button>
      )}
      <div data-testid="list" ref={list} tabIndex={-1}>
        <input aria-label="Available To" />
      </div>
      <DeleteAssignmentsDialog
        api={api}
        focusAfterDelete={list}
        onClose={() => setTargets(undefined)}
        onDeleted={(ids) => {
          onDeleted(ids);
          if (ids.length > 0) setGone(true);
        }}
        targets={targets}
      />
    </>
  );
}

async function confirmDelete() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Delete Selected' }));
  await user.click(await screen.findByRole('button', { name: 'valid-assignments.delete-confirm' }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('DeleteAssignmentsDialog', { timeout: 10_000 }, () => {
  it("shows the server's reason when it refuses every delete", async () => {
    remove.mockRejectedValue(httpError(403, { message: 'You do not have the right.' }));
    renderPage(<Harness onDeleted={vi.fn()} />);

    await confirmDelete();

    expect(await screen.findByText('You do not have the right.')).toBeVisible();
  });

  it('deletes every picked row, says so and closes', async () => {
    const onDeleted = vi.fn();
    remove.mockResolvedValue(undefined);
    renderPage(<Harness onDeleted={onDeleted} />);

    await confirmDelete();

    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledWith(['a', 'b']));
    expect(toast.success).toHaveBeenCalledWith('valid-assignments.deleted-title', {
      description: 'valid-assignments.deleted',
    });
    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('keeps focus on the list once the button that opened it is gone', async () => {
    remove.mockResolvedValue(undefined);
    renderPage(<Harness onDeleted={vi.fn()} />);

    await confirmDelete();

    await vi.waitFor(() => expect(screen.getByTestId('list')).toHaveFocus());
  });

  it('reports the rows that could not be deleted apart from the ones that were', async () => {
    const onDeleted = vi.fn();
    remove.mockImplementation((id: string) =>
      id === 'b' ? Promise.reject(httpError(500, {})) : Promise.resolve(),
    );
    renderPage(<Harness onDeleted={onDeleted} />);

    await confirmDelete();

    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledWith(['a']));
    expect(toast.error).toHaveBeenCalledWith('valid-assignments.partly-deleted-title', {
      description: 'valid-assignments.partly-deleted',
    });
  });

  it('stays open with an error when nothing could be deleted', async () => {
    const onDeleted = vi.fn();
    remove.mockRejectedValue(httpError(500, {}));
    renderPage(<Harness onDeleted={onDeleted} />);

    await confirmDelete();

    expect(await screen.findByText('valid-assignments.delete-error-title')).toBeVisible();
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(onDeleted).toHaveBeenCalledWith([]);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
