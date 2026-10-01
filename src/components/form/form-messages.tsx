import { createContext, type ReactNode, use, useMemo } from 'react';

type FormMessages = {
  formatError: (message: string) => string;
  aboutLabel: (label: string) => string;
};

const defaultAboutLabel = (label: string) => `About ${label}`;

const FormMessagesContext = createContext<FormMessages>({
  formatError: (message) => message,
  aboutLabel: defaultAboutLabel,
});

type FormMessagesProviderProps = {
  /** Turns a validation message into display text, e.g. by translating a message key. */
  formatError: (message: string) => string;
  /** Names the info button that shows a field's description. */
  aboutLabel?: (label: string) => string;
  children: ReactNode;
};

export function FormMessagesProvider({
  formatError,
  aboutLabel = defaultAboutLabel,
  children,
}: FormMessagesProviderProps) {
  const messages = useMemo(() => ({ formatError, aboutLabel }), [formatError, aboutLabel]);
  return <FormMessagesContext value={messages}>{children}</FormMessagesContext>;
}

export function useFormatError() {
  return use(FormMessagesContext).formatError;
}

export function useAboutLabel() {
  return use(FormMessagesContext).aboutLabel;
}
