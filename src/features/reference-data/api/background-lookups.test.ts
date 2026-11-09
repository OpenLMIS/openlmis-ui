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
