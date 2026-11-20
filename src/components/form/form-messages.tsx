import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { DEFAULT_DATE_FORMAT } from '@/components/form/date-value';
import type { Calendar } from '@/components/ui/calendar';

type Locale = NonNullable<ComponentProps<typeof Calendar>['locale']>;

type DateFormatSource = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => string;
};

type FormMessages = {
  formatError: (message: string) => string;
  aboutLabel: (label: string) => string;
  requiredLabel: string;
  dateLanguage: string;
  dateFormat: string | DateFormatSource;
  calendarLabel: string;
  loadDateLocale: (() => Promise<Locale>) | undefined;
};

const defaultAboutLabel = (label: string) => `About ${label}`;

const FormMessagesContext = createContext<FormMessages>({
  formatError: (message) => message,
  aboutLabel: defaultAboutLabel,
  requiredLabel: 'Required',
  dateLanguage: 'en-US',
  dateFormat: DEFAULT_DATE_FORMAT,
  calendarLabel: 'Open Calendar',
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
  dateFormat?: FormMessages['dateFormat'];
  calendarLabel?: string;
  /** The calendar's language, loaded with the calendar; English when left out. */
  loadDateLocale?: () => Promise<Locale>;
  children: ReactNode;
};

export function FormMessagesProvider({
  formatError,
  aboutLabel = defaultAboutLabel,
  requiredLabel = 'Required',
  dateLanguage = 'en-US',
  dateFormat,
  calendarLabel = 'Open Calendar',
  loadDateLocale,
  children,
}: FormMessagesProviderProps) {
  const inheritedFormat = use(FormMessagesContext).dateFormat;
  const format = dateFormat ?? inheritedFormat;
  const messages = useMemo(
    () => ({
      formatError,
      aboutLabel,
      requiredLabel,
      dateLanguage,
      dateFormat: format,
      calendarLabel,
      loadDateLocale,
    }),
    [formatError, aboutLabel, requiredLabel, dateLanguage, format, calendarLabel, loadDateLocale],
  );
  return <FormMessagesContext value={messages}>{children}</FormMessagesContext>;
}

export function useFormatError() {
  return use(FormMessagesContext).formatError;
}

export function useAboutLabel() {
  return use(FormMessagesContext).aboutLabel;
}

export function useRequiredLabel() {
  return use(FormMessagesContext).requiredLabel;
}

export function useDateMessages() {
  const { requiredLabel, dateLanguage, calendarLabel, loadDateLocale } = use(FormMessagesContext);
  return { requiredLabel, dateLanguage, calendarLabel, loadDateLocale };
}

const subscribeToStaticFormat = () => () => {};

export function useDateFormat() {
  const { dateFormat } = use(FormMessagesContext);
  const subscribe = typeof dateFormat === 'string' ? subscribeToStaticFormat : dateFormat.subscribe;
  const getSnapshot = typeof dateFormat === 'string' ? () => dateFormat : dateFormat.getSnapshot;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
