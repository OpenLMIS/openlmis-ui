import { createContext, type ReactNode, use, useMemo } from 'react';

export type FormMessages = {
  /** Turns a validation message into display text, e.g. by translating a message key. */
  formatError: (message: string) => string;
};

const defaultFormMessages: FormMessages = {
  formatError: (message) => message,
};

const FormMessagesContext = createContext<FormMessages>(defaultFormMessages);

type FormMessagesProviderProps = {
  messages: Partial<FormMessages>;
  children: ReactNode;
};

/** Sets how every form field below shows its validation messages. */
export function FormMessagesProvider({ messages, children }: FormMessagesProviderProps) {
  const value = useMemo(() => ({ ...defaultFormMessages, ...messages }), [messages]);
  return <FormMessagesContext value={value}>{children}</FormMessagesContext>;
}

export function useFormMessages() {
  return use(FormMessagesContext);
}
