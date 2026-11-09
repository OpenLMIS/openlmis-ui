import { QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import type { InternalAxiosRequestConfig } from 'axios';
import { expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  currencySettingsOptions,
  deploymentTimeZoneOptions,
  minimalFacilitiesOptions,
  programsOptions,
} from '@/features/reference-data/api/queries';
import { client } from '@/integrations/axios';
import { setBackgroundRouteLoading } from '@/lib/background-request-gate';

it.each(['currency', 'facilities', 'programs'] as const)(
  'lets a foreground %s loader finish while its background lookup is paused',
  async (kind) => {
    useLoginData.getState().setLoginData({
      referenceDataUserId: 'u',
      username: 'u',
      accessToken: 'token',
    });
    const original = client.defaults.adapter;
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({
      data:
        kind === 'currency'
          ? { timeZoneId: 'Africa/Luanda' }
          : kind === 'facilities'
            ? { content: [] }
            : [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }));
    client.defaults.adapter = adapter;
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const controller = new AbortController();
    const read = (backgroundDownload = false): Promise<unknown> => {
      const config = { backgroundDownload, signal: controller.signal };
      if (kind === 'currency')
        return backgroundDownload
          ? queries.fetchQuery(currencySettingsOptions(config))
          : queries.fetchQuery(deploymentTimeZoneOptions());
      if (kind === 'facilities') return queries.fetchQuery(minimalFacilitiesOptions(config));
      return queries.fetchQuery(programsOptions(config));
    };
    setBackgroundRouteLoading(true);
    const background = read(true).catch(() => undefined);
    let complete = false;
    const foreground = read().then(() => {
      complete = true;
    });
    try {
      await waitFor(() => expect(complete).toBe(true));
      expect(adapter).toHaveBeenCalledOnce();
    } finally {
      controller.abort();
      queries.clear();
      setBackgroundRouteLoading(false);
      client.defaults.adapter = original;
      await background;
      await foreground;
    }
  },
);

it.each(['currency', 'facilities', 'programs'] as const)(
  'warms the foreground %s cache only after a completed background lookup',
  async (kind) => {
    const original = client.defaults.adapter;
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({
      data:
        kind === 'currency' ? { timeZoneId: 'UTC' } : kind === 'facilities' ? { content: [] } : [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }));
    client.defaults.adapter = adapter;
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const options =
      kind === 'currency'
        ? currencySettingsOptions
        : kind === 'facilities'
          ? minimalFacilitiesOptions
          : programsOptions;
    try {
      const background = await queries.fetchQuery(options({ backgroundDownload: true }) as never);
      expect(queries.getQueryData(options().queryKey)).toEqual(background);
      await queries.fetchQuery(options() as never);
      expect(adapter).toHaveBeenCalledOnce();
    } finally {
      queries.clear();
      client.defaults.adapter = original;
    }
  },
);

it.each(['existing', 'identity'] as const)(
  'does not replace a foreground lookup after %s changes',
  async (change) => {
    useLoginData.getState().setLoginData({
      referenceDataUserId: 'original',
      username: 'u',
      accessToken: 'token',
    });
    const original = client.defaults.adapter;
    const pending = Promise.withResolvers<void>();
    const started = Promise.withResolvers<void>();
    client.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      started.resolve();
      await pending.promise;
      return { data: [], status: 200, statusText: 'OK', headers: {}, config };
    };
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const background = queries.fetchQuery(programsOptions({ backgroundDownload: true }));
    const outcome = background.catch(() => undefined);
    try {
      await started.promise;
      const foreground = [{ id: 'current', name: 'Current', code: 'C', active: true }];
      if (change === 'existing') {
        queries.setQueryData(programsOptions().queryKey, foreground);
        await queries.invalidateQueries({ queryKey: programsOptions().queryKey });
      } else useLoginData.setState({ referenceDataUserId: 'another' });
      pending.resolve();
      await outcome;
      expect(queries.getQueryData(programsOptions().queryKey)).toEqual(
        change === 'existing' ? foreground : undefined,
      );
      if (change === 'existing')
        expect(queries.getQueryState(programsOptions().queryKey)?.isInvalidated).toBe(true);
    } finally {
      pending.resolve();
      await outcome;
      queries.clear();
      client.defaults.adapter = original;
    }
  },
);
