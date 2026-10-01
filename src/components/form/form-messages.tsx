import { type ComponentProps, createContext, type ReactNode, use, useMemo } from 'react';
import type { Calendar } from '@/components/ui/calendar';

type Locale = ComponentProps<typeof Calendar>['locale'];

type FormMessages = {
  formatError: (message: string) => string;
  aboutLabel: (label: string) => string;
  dateLocale: Locale | undefined;
};

const defaultAboutLabel = (label: string) => `About ${label}`;

const FormMessagesContext = createContext<FormMessages>({
  formatError: (message) => message,
  aboutLabel: defaultAboutLabel,
  dateLocale: undefined,
});

type FormMessagesProviderProps = {
  /** Turns a validation message into display text, e.g. by translating a message key. */
  formatError: (message: string) => string;
  /** Names the info button that shows a field's description. */
  aboutLabel?: (label: string) => string;
  dateLocale?: Locale;
  children: ReactNode;
};

export function FormMessagesProvider({
  formatError,
  aboutLabel = defaultAboutLabel,
  dateLocale,
  children,
}: FormMessagesProviderProps) {
  const messages = useMemo(
    () => ({ formatError, aboutLabel, dateLocale }),
    [formatError, aboutLabel, dateLocale],
  );
  return <FormMessagesContext value={messages}>{children}</FormMessagesContext>;
}

export function useFormatError() {
  return use(FormMessagesContext).formatError;
}

export function useAboutLabel() {
  return use(FormMessagesContext).aboutLabel;
}

export function useDateLocale() {
  return use(FormMessagesContext).dateLocale;
}
