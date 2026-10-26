import { render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { EventDraftStatus } from '@/features/stock-events/components/event-draft-status';

it('focuses Load Saved Draft before the shared overwrite choice', async () => {
  render(<EventDraftStatus status="conflict" onRetry={vi.fn()} onResolve={vi.fn()} />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'stock-events.draft-load' })).toHaveFocus(),
  );
});
