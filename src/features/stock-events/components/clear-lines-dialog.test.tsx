import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { I18nextProvider } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { ClearLinesDialog } from '@/features/stock-events/components/clear-lines-dialog';

const i18n = createInstance();
beforeAll(() =>
  i18n.use(ICU).init({ lng: 'en', resources: { en: { translation: en } }, keySeparator: false }),
);
describe('ClearLinesDialog', () => {
  it.each([
    [1, 'This will remove 1 product line and its quantity.'],
    [3, 'This will remove 3 product lines and their quantities.'],
  ])('names exactly %i lines being cleared', (count, text) => {
    render(
      <I18nextProvider i18n={i18n}>
        <ClearLinesDialog count={Number(count)} onClear={vi.fn()} onOpenChange={vi.fn()} open />
      </I18nextProvider>,
    );
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName('Clear Products?');
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
