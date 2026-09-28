import { queryOptions } from '@tanstack/react-query';
import {
  fetchDigestConfigurations,
  fetchPendingEmail,
  fetchProfile,
  fetchSubscriptions,
} from '@/features/profile/api/api';
import { queryKeys } from '@/lib/key-factory';

export const profileOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.profile.detail(userId),
    queryFn: () => fetchProfile(userId),
  });

export const pendingEmailOptions = (userId: string) =>
  queryOptions({
    queryKey: [...queryKeys.profile.all, 'pending-email', userId] as const,
    queryFn: () => fetchPendingEmail(userId),
  });

export const digestConfigurationsOptions = () =>
  queryOptions({
    queryKey: [...queryKeys.profile.all, 'digest-configurations'] as const,
    queryFn: fetchDigestConfigurations,
    staleTime: 10 * 60 * 1000,
  });

export const subscriptionsOptions = (userId: string) =>
  queryOptions({
    queryKey: [...queryKeys.profile.all, 'subscriptions', userId] as const,
    queryFn: () => fetchSubscriptions(userId),
  });
