import { type ComponentProps, createContext, type ReactNode, use, useMemo } from 'react';
import type { Calendar } from '@/components/ui/calendar';

type Locale = NonNullable<ComponentProps<typeof Calendar>['locale']>;

type FormMessages = {
  formatError: (message: string) => string;
  aboutLabel: (label: string) => string;
  requiredLabel: string;
  dateLanguage: string;
  loadDateLocale: (() => Promise<Locale>) | undefined;
};

const defaultAboutLabel = (label: string) => `About ${label}`;

const FormMessagesContext = createContext<FormMessages>({
  formatError: (message) => message,
  aboutLabel: defaultAboutLabel,
  requiredLabel: 'Required',
  dateLanguage: 'en-US',
  loadDateLocale: undefined,
});

type FormMessagesProviderProps = {
  /** Turns a validation message into display text, e.g. by translating a message key. */
  formatError: (message: string) => string;
  /** Names the info button that shows a field's description. */
  aboutLabel?: (label: string) => string;
  /** Read out with a field that must be filled in but cannot say so itself, such as a date. */
  requiredLabel?: string;
  /** The language dates are shown in. */
  dateLanguage?: string;
  /** The calendar's language, loaded with the calendar; English when left out. */
  loadDateLocale?: () => Promise<Locale>;
  children: ReactNode;
};

export function FormMessagesProvider({
  formatError,
  aboutLabel = defaultAboutLabel,
  requiredLabel = 'Required',
  dateLanguage = 'en-US',
  loadDateLocale,
  children,
}: FormMessagesProviderProps) {
  const messages = useMemo(
    () => ({ formatError, aboutLabel, requiredLabel, dateLanguage, loadDateLocale }),
    [formatError, aboutLabel, requiredLabel, dateLanguage, loadDateLocale],
  );
  return <FormMessagesContext value={messages}>{children}</FormMessagesContext>;
}

export function useFormatError() {
  return use(FormMessagesContext).formatError;
}

export function useAboutLabel() {
  return use(FormMessagesContext).aboutLabel;
}

export function useDateMessages() {
  const { requiredLabel, dateLanguage, loadDateLocale } = use(FormMessagesContext);
  return { requiredLabel, dateLanguage, loadDateLocale };
}
