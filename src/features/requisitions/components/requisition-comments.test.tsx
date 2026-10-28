import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { requisitionStatusMessagesOptions } from '@/features/requisitions/api/queries';
import { RequisitionComments } from '@/features/requisitions/components/requisition-comments';
import type {
  RequisitionRecord,
  RequisitionStatusMessage,
} from '@/features/requisitions/lib/types';
import { IsolatingICU } from '@/lib/isolate-values';

const i18n = createInstance();
beforeAll(() =>
  i18n.use(IsolatingICU).init({
    lng: 'en',
    keySeparator: false,
    nsSeparator: false,
    resources: { en: { translation: en } },
  }),
);

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
});

const rejection = {
  status: 'REJECTED' as const,
  createdDate: '2026-10-27T10:00:00Z',
  statusMessageDto: {
    status: 'REJECTED' as const,
    createdDate: '2026-10-27T10:00:00Z',
    authorFirstName: 'Jane',
    authorLastName: 'Doe',
  },
  rejectionDtos: [
    { id: 'reason-1', rejectionReason: { name: 'Incorrect quantities' } },
    { id: 'reason-2', rejectionReason: { name: 'Missing explanation' } },
  ],
};
function renderComments(
  history: NonNullable<RequisitionRecord['statusHistory']> = [rejection],
  messages: RequisitionStatusMessage[] = [rejection.statusMessageDto],
) {
  const record = {
    id: 'r',
    status: 'REJECTED',
    emergency: false,
    facility: { id: 'f' },
    program: { id: 'p' },
    processingPeriod: { id: 'period' },
    template: { columnsMap: {} },
    requisitionLineItems: [],
    statusHistory: history,
  } satisfies RequisitionRecord;
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  clients.push(client);
  client.setQueryData(requisitionStatusMessagesOptions(record.id).queryKey, messages);
  client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
  const onRejection = vi.fn();
  function Comments() {
    const [open, setOpen] = useState(false);
    return (
      <RequisitionComments
        record={record}
        rejection={open}
        onHistory={vi.fn()}
        onRejection={() => {
          onRejection();
          setOpen(true);
        }}
        onClose={() => setOpen(false)}
      />
    );
  }
  render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <Comments />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return { onRejection };
}

it('lists the latest rejected record’s backend rejectionDtos', async () => {
  const { onRejection } = renderComments([
    {
      ...rejection,
      createdDate: '2026-10-26T10:00:00Z',
      rejectionDtos: [{ id: 'old', rejectionReason: { name: 'Old reason' } }],
    },
    rejection,
  ]);
  await userEvent.click(screen.getByRole('button', { name: 'View Rejection Reason(s)' }));
  expect(onRejection).toHaveBeenCalledOnce();
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Incorrect quantities')).toBeInTheDocument();
  expect(within(dialog).getByText('Missing explanation')).toBeInTheDocument();
  expect(within(dialog).queryByText('Old reason')).not.toBeInTheDocument();
  expect(within(dialog).getAllByRole('listitem')).toHaveLength(2);
  expect(within(dialog).getByText('Rejected')).toBeInTheDocument();
  expect(within(dialog).getByText(/Jane Doe on Oct 27, 2026/)).toBeInTheDocument();
});

it('hides history and rejection actions when there are no messages or latest reasons', () => {
  renderComments(
    [
      { ...rejection, createdDate: '2026-10-26T10:00:00Z' },
      { ...rejection, rejectionDtos: [] },
    ],
    [],
  );
  expect(screen.queryByRole('button', { name: 'View History' })).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'View Rejection Reason(s)' }),
  ).not.toBeInTheDocument();
});

it('shows the rejection date without an author when the server omits names', async () => {
  renderComments([{ ...rejection, statusMessageDto: null }], []);
  await userEvent.click(screen.getByRole('button', { name: 'View Rejection Reason(s)' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Oct 27, 2026, 10:00:00 AM')).toBeInTheDocument();
});
