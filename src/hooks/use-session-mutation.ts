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
  const completion =
    <TArgs extends unknown[]>(callback: ((...args: TArgs) => unknown) | undefined) =>
    async (...args: TArgs) => {
      if (!current()) return;
      const result = await callback?.(...args);
      assertSessionScope(scope);
      return result;
    };
  const mutation = useMutation<TData, TError, TVariables, TContext>({
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
    onSuccess: completion(options.onSuccess),
    onError: completion(options.onError),
    onSettled: completion(options.onSettled),
  });
  return { ...mutation, isCurrent: current };
}
