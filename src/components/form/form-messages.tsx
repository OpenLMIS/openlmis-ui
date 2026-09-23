import { createContext, type ReactNode, use } from 'react';

const FormatErrorContext = createContext<(message: string) => string>((message) => message);

type FormMessagesProviderProps = {
  /** Turns a validation message into display text, e.g. by translating a message key. */
  formatError: (message: string) => string;
  children: ReactNode;
};

export function FormMessagesProvider({ formatError, children }: FormMessagesProviderProps) {
  return <FormatErrorContext value={formatError}>{children}</FormatErrorContext>;
}

export function useFormatError() {
  return use(FormatErrorContext);
}
