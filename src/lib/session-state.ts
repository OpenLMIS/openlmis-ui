import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';

export const getSessionState = useLoginData.getState;
export const subscribeSessionState = useLoginData.subscribe;
export const isSessionEnded = (error: unknown) => error instanceof SessionEndedError;
