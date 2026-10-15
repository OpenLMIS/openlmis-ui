import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { beforeAll, expect, it, vi } from 'vitest';
import { TranslatedFormMessages } from '@/components/translated-form-messages';
import { CategoryEditor } from '@/features/rejection-reasons/components/category-editor';
import { client } from '@/integrations/axios';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';
import en from '../../../../public/locales/en.json';

vi.mock('@/integrations/axios', () => ({ client: { post: vi.fn() } }));

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

it('keeps a rejected edit and server message, then sends the full record on retry before leaving', async () => {
  const saved = {
    id: 'category-id',
    name: 'Original',
    code: 'C',
    active: false,
    extraData: { preserve: true },
  };
  const onSaved = vi.fn();
  const user = userEvent.setup();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(queryClient, 'invalidateQueries').mockRejectedValue(new Error('refresh offline'));
  vi.mocked(client.post).mockRejectedValueOnce(
    httpError(400, { message: 'That code is already used.' }),
  );
  vi.mocked(client.post).mockResolvedValueOnce({ data: { ...saved, name: ' Updated ' } });
  renderPage(
    <TranslatedFormMessages>
      <CategoryEditor saved={saved} onSaved={onSaved} onCancel={vi.fn()} />
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
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-disabled', 'true'),
  );
  expect(client.post).toHaveBeenLastCalledWith('/rejectionReasonCategories', {
    ...saved,
    name: ' Updated ',
  });
});
