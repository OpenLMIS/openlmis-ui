import type { ParseKeys } from 'i18next';
import { type ReactNode, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FormMessagesProvider } from '@/components/form/form-messages';
import { dateLocaleFor } from '@/lib/date-locale';

/** Form validation messages are translation keys; this resolves them in the current language. */
export function TranslatedFormMessages({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const formatError = useCallback((message: string) => t(message as ParseKeys), [t]);
  const aboutLabel = useCallback((label: string) => t('form.about-label', { name: label }), [t]);

  return (
    <FormMessagesProvider
      aboutLabel={aboutLabel}
      dateLocale={dateLocaleFor(i18n.language)}
      formatError={formatError}
    >
      {children}
    </FormMessagesProvider>
  );
}
