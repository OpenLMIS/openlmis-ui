import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { I18nextProvider } from 'react-i18next';
import { beforeAll, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { SubmitConfirmDialog } from '@/features/stock-events/components/submit-confirm-dialog';

const i18n = createInstance();
beforeAll(() =>
  i18n.use(ICU).init({
    lng: 'en',
    resources: {
      en: {
        translation: {
          ...en,
          'stock-events.signature-title': 'Confirm Stock Events',
          'stock-events.clear-description':
            'Do you, {user}, confirm {count, plural, one {# line} other {# lines}}?',
        },
      },
    },
    keySeparator: false,
  }),
);

it('names the user and counts draft lines, confirming without a signature and cancelling without submit', async () => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <SubmitConfirmDialog
        open
        pending={false}
        username="ada"
        count={2}
        title="stock-events.signature-title"
        description="stock-events.clear-description"
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />
    </I18nextProvider>,
  );
  expect(screen.getByRole('alertdialog')).toHaveAccessibleName('Confirm Stock Events');
  expect(screen.getByText('Do you, ada, confirm 2 lines?')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(onConfirm).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(onConfirm).toHaveBeenCalledExactlyOnceWith();
});
