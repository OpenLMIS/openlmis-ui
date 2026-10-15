import { QueryClient } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { TranslatedFormMessages } from '@/components/translated-form-messages';
import { CategoryFormDialog } from '@/features/rejection-reasons/components/category-form-dialog';
import type { CategoriesSearch } from '@/features/rejection-reasons/lib/search';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { client } from '@/integrations/axios';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';
import en from '../../../../public/locales/en.json';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn(), post: vi.fn() } }));

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

it('keeps a rejected edit and server message, then sends the full record on retry before leaving', async () => {
  const saved = {
    id: 'category-id',
    name: 'Original',
    code: 'C',
    active: false,
    extraData: { preserve: true },
  };
  const onSaved = vi.fn();
  vi.mocked(client.get).mockResolvedValueOnce({ data: saved });
  const user = userEvent.setup();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(queryClient, 'invalidateQueries').mockRejectedValue(new Error('refresh offline'));
  vi.mocked(client.post).mockRejectedValueOnce(
    httpError(400, { message: 'That code is already used.' }),
  );
  vi.mocked(client.post).mockResolvedValueOnce({ data: { ...saved, name: ' Updated ' } });
  renderPage(
    <TranslatedFormMessages>
      <CategoryFormDialog target={saved.id} onClose={onSaved} />
    </TranslatedFormMessages>,
    { queryClient },
  );
  const name = await screen.findByRole('textbox', { name: /^Name/ });
  await user.clear(name);
  await user.type(name, ' Updated ');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('That code is already used.')).toBeVisible();
  expect(name).toHaveValue(' Updated ');
  expect(onSaved).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(client.post).toHaveBeenLastCalledWith('/rejectionReasonCategories', {
    ...saved,
    name: ' Updated ',
  });
});

const EDIT_ID = 'ff636054-6812-441e-bc28-62a5e018aadb';
const CLOSED_DIALOGS = { category: undefined };

function CategoryDialogHarness() {
  const target = useRouterState({
    select: (state) => state.location.search.category as string | undefined,
  });
  const { openDialog, closeDialog } = useSearchNavigation<CategoriesSearch>(CLOSED_DIALOGS);
  return (
    <>
      <button type="button" onClick={() => void openDialog({ category: EDIT_ID })}>
        Edit category
      </button>
      <CategoryFormDialog target={target} onClose={closeDialog} />
    </>
  );
}

it('guards dialog close and rereads the same record when reopened, preserving list state', async () => {
  vi.mocked(client.get).mockResolvedValueOnce({
    data: { id: EDIT_ID, name: 'Original', code: 'C', active: true },
  });
  vi.mocked(client.get).mockResolvedValueOnce({
    data: { id: EDIT_ID, name: 'Fresh server name', code: 'C', active: true },
  });
  const user = userEvent.setup();
  const router = renderPage(
    <TranslatedFormMessages>
      <CategoryDialogHarness />
    </TranslatedFormMessages>,
    {
      path: `/?category=${EDIT_ID}&page=3&size=5&name=Original`,
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
      }),
    },
  );
  const name = await screen.findByRole('textbox', { name: /^Name/ });
  expect(name).toHaveValue('Original');
  await user.clear(name);
  await user.type(name, 'Unsaved draft');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await screen.findByRole('alertdialog');
  await user.click(screen.getByRole('button', { name: 'Keep Editing' }));
  expect(await screen.findByRole('textbox', { name: /^Name/ })).toHaveValue('Unsaved draft');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await screen.findByRole('alertdialog');
  await user.click(screen.getByRole('button', { name: 'Discard Changes' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(router.state.location.search).toMatchObject({ page: 3, size: 5, name: 'Original' });
  expect(router.state.location.search).not.toHaveProperty('category');
  await user.click(screen.getByRole('button', { name: 'Edit category' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('Fresh server name'),
  );
  expect(client.post).not.toHaveBeenCalled();
});
