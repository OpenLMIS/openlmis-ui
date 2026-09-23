import type { ParseKeys } from 'i18next';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type FormMessages, FormMessagesProvider } from '@/components/form/form-messages';

/** Form validation messages are translation keys; this resolves them in the current language. */
export function TranslatedFormMessages({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const messages = useMemo(
    (): Partial<FormMessages> => ({ formatError: (message) => t(message as ParseKeys) }),
    [t],
  );

  return <FormMessagesProvider messages={messages}>{children}</FormMessagesProvider>;
}
