import type { ParseKeys } from 'i18next';
import { type ReactNode, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FormMessagesProvider } from '@/components/form/form-messages';

/** Form validation messages are translation keys; this resolves them in the current language. */
export function TranslatedFormMessages({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const formatError = useCallback((message: string) => t(message as ParseKeys), [t]);
  const aboutLabel = useCallback((label: string) => t('form.about-label', { name: label }), [t]);

  return (
    <FormMessagesProvider aboutLabel={aboutLabel} formatError={formatError}>
      {children}
    </FormMessagesProvider>
  );
}
