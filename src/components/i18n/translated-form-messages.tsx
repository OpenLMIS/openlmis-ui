import { type QueryClient, QueryClientContext, QueryObserver } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { type ReactNode, use, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_DATE_FORMAT, supportedDateFormat } from '@/components/form/date-value';
import { FormMessagesProvider } from '@/components/form/form-messages';
import { currencySettingsOptions } from '@/features/reference-data/api/queries';
import { loadDateLocale } from '@/lib/date-locale';
import { storedDateFormat } from '@/lib/deployment-date-format';

function deploymentDateFormatSource(queryClient: QueryClient) {
  const options = currencySettingsOptions();
  const createObserver = () =>
    new QueryObserver(queryClient, { ...options, retry: false, notifyOnChangeProps: ['data'] });
  let observer: ReturnType<typeof createObserver> | undefined;

  return {
    subscribe(onChange: () => void) {
      // Only date controls subscribe, and they share one observer while mounted.
      if (!observer?.hasListeners()) observer = createObserver();
      return observer.subscribe(onChange);
    },
    getSnapshot() {
      const data = queryClient.getQueryData(options.queryKey);
      if (data?.dateFormat === undefined) return storedDateFormat();
      return supportedDateFormat(data.dateFormat) ? data.dateFormat : DEFAULT_DATE_FORMAT;
    },
  };
}

/** Form validation messages are translation keys; this resolves them in the current language. */
export function TranslatedFormMessages({ children }: { children: ReactNode }) {
  const queryClient = use(QueryClientContext);
  const dateFormat = useMemo(
    () => (queryClient ? deploymentDateFormatSource(queryClient) : storedDateFormat()),
    [queryClient],
  );
  const { t, i18n } = useTranslation();
  const formatError = useCallback((message: string) => t(message as ParseKeys), [t]);
  const aboutLabel = useCallback((label: string) => t('form.about-label', { name: label }), [t]);
  const loadLocale = useCallback(() => loadDateLocale(i18n.language), [i18n.language]);

  return (
    <FormMessagesProvider
      aboutLabel={aboutLabel}
      calendarLabel={t('form.open-calendar')}
      dateFormat={dateFormat}
      dateLanguage={i18n.language}
      formatError={formatError}
      loadDateLocale={loadLocale}
      requiredLabel={t('form.required')}
    >
      {children}
    </FormMessagesProvider>
  );
}
