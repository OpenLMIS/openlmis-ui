import {
  type DefaultError,
  type MutationFunction,
  type UseMutationOptions,
  useMutation,
} from '@tanstack/react-query';
import { useState } from 'react';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export function useSessionMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext> & {
    mutationFn: MutationFunction<TData, TVariables>;
  },
) {
  const [scope] = useState(getSessionScope);
  const onMutate = options.onMutate;
  const current = () => scope === getSessionScope();
  return useMutation<TData, TError, TVariables, TContext>({
    ...options,
    mutationFn: async (...args) => {
      assertSessionScope(scope);
      const result = await options.mutationFn(...args);
      assertSessionScope(scope);
      return result;
    },
    onMutate: onMutate
      ? async (...args) => {
          assertSessionScope(scope);
          const result = await onMutate(...args);
          assertSessionScope(scope);
          return result;
        }
      : undefined,
    onSuccess: (...args) => (current() ? options.onSuccess?.(...args) : undefined),
    onError: (...args) => (current() ? options.onError?.(...args) : undefined),
    onSettled: (...args) => (current() ? options.onSettled?.(...args) : undefined),
  });
}
