import { act, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { expect, it } from 'vitest';
import ar from '@/../public/locales/ar.json';
import en from '@/../public/locales/en.json';
import { useDataTableLabels } from '@/components/data-table/data-table-labels';
import { TranslatedDataTableLabels } from '@/components/translated-data-table-labels';

function InvalidPageLabel() {
  return <p>{useDataTableLabels().invalidPage}</p>;
}

it('translates the invalid page label and follows a language change', async () => {
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    keySeparator: false,
    resources: { en: { translation: en }, ar: { translation: ar } },
  });
  render(
    <I18nextProvider i18n={i18n}>
      <TranslatedDataTableLabels>
        <InvalidPageLabel />
      </TranslatedDataTableLabels>
    </I18nextProvider>,
  );
  expect(screen.getByText('Contains Invalid Rows')).toBeInTheDocument();
  await act(() => i18n.changeLanguage('ar'));
  expect(screen.getByText('تحتوي على صفوف غير صالحة')).toBeInTheDocument();
});
