import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { TranslatedFormMessages } from '@/components/translated-form-messages';
import { RejectionReasonFormDialog } from '@/features/rejection-reasons/components/rejection-reason-form-dialog';
import { client } from '@/integrations/axios';
import { queryKeys } from '@/lib/key-factory';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';
import en from '../../../../public/locales/en.json';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn(), post: vi.fn() } }));

const category = { id: 'c1', name: 'Original category', code: 'C1', active: true };
const other = {
  id: 'c2',
  name: 'Inactive category',
  code: 'C2',
  active: false,
  extraData: { keep: true },
};
const saved = {
  id: 'r1',
  name: 'Original reason',
  code: 'R',
  active: true,
  rejectionReasonCategory: category,
  extraData: { keep: 'reason' },
};

beforeAll(async () => {
  await i18n
    .use(ICU)
    .use(initReactI18next)
    .init({
      lng: 'en',
      fallbackLng: 'en',
      keySeparator: false,
      nsSeparator: false,
      resources: { en: { translation: en } },
    });
});
beforeEach(() => vi.resetAllMocks());

function setup(add = false, categories?: (typeof category)[]) {
  const onSaved = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  if (!add) vi.mocked(client.get).mockResolvedValueOnce({ data: saved });
  if (categories) queryClient.setQueryData(queryKeys.rejectionReasonCategories.list(), categories);
  renderPage(
    <TranslatedFormMessages>
      <RejectionReasonFormDialog target={add ? 'new' : saved.id} onClose={onSaved} />
    </TranslatedFormMessages>,
    { queryClient, onCaughtError: () => undefined },
  );
  return { user: userEvent.setup(), onSaved, queryClient };
}

async function choose(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(await screen.findByRole('combobox', { name: /^Category/ }));
  await user.click(await screen.findByRole('option', { name: label }));
}

it('keeps a rejected edit and posts the whole chosen inactive category with unknown saved fields on retry', async () => {
  const { user, onSaved } = setup(false, [category, other]);
  vi.mocked(client.post).mockRejectedValueOnce(
    httpError(400, { message: 'That name is already used.' }),
  );
  vi.mocked(client.post).mockResolvedValueOnce({
    data: { ...saved, name: ' Entered ', rejectionReasonCategory: other },
  });
  const name = await screen.findByRole('textbox', { name: /^Name/ });
  await user.clear(name);
  await user.type(name, ' Entered ');
  await choose(user, 'Inactive category (Inactive)');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('That name is already used.')).toBeVisible();
  expect(name).toHaveValue(' Entered ');
  expect(screen.getByRole('combobox', { name: /^Category/ })).toHaveTextContent(
    'Inactive category',
  );
  expect(onSaved).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(client.post).toHaveBeenLastCalledWith('/rejectionReasons', {
    ...saved,
    name: ' Entered ',
    rejectionReasonCategory: other,
  });
});

it('keeps typed Add fields through a category failure and retry, then selects the sole category', async () => {
  const gate = Promise.withResolvers<unknown>();
  vi.mocked(client.get).mockReturnValueOnce(gate.promise as ReturnType<typeof client.get>);
  vi.mocked(client.get).mockResolvedValue({
    data: { content: [other], totalPages: 1, size: 2147483647 },
  });
  const { user } = setup(true);
  const dialog = await screen.findByRole('dialog');
  const name = await within(dialog).findByRole('textbox', { name: /^Name/ });
  await user.type(name, 'Typed during loading');
  await user.type(within(dialog).getByRole('textbox', { name: /^Code/ }), 'NEW');
  expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
  await act(async () => {
    gate.reject(httpError(500));
  });
  expect(await screen.findByText('Could Not Load Categories')).toBeVisible();
  expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(client.post).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Try Again' }));
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: /^Category/ })).toHaveTextContent(
      'Inactive category',
    ),
  );
  expect(name).toHaveValue('Typed during loading');
  expect(within(dialog).getByRole('textbox', { name: /^Code/ })).toHaveValue('NEW');
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled());
});

it('keeps a missing saved category visible and blocks saving until a valid choice, preserving the choice on refresh', async () => {
  const { user, queryClient } = setup(false, [other]);
  const picker = await screen.findByRole('combobox', { name: /^Category/ });
  expect(picker).toHaveTextContent('Original category (Unavailable)');
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  await choose(user, 'Inactive category (Inactive)');
  await act(async () => {
    queryClient.setQueryData(queryKeys.rejectionReasonCategories.list(), [category, other]);
  });
  expect(picker).toHaveTextContent('Inactive category');
  expect(picker).not.toHaveTextContent('Original category');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
});

it('does not auto-select a category when a later refresh reduces an initially multiple-choice Add list to one', async () => {
  const { user, queryClient } = setup(true, [category, other]);
  const picker = await screen.findByRole('combobox', { name: /^Category/ });
  expect(picker).toHaveTextContent('Choose a category');
  await act(async () => {
    queryClient.setQueryData(queryKeys.rejectionReasonCategories.list(), [other]);
  });
  await user.click(picker);
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
  expect(screen.getByRole('option', { name: 'Inactive category (Inactive)' })).toBeVisible();
  expect(picker).toHaveTextContent('Choose a category');
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});
