import { waitFor } from '@testing-library/react';
import { type AxiosAdapter, isCancel } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { abortable, prepareReport } from '@/features/reports/components/report-delivery';
import { client } from '@/integrations/axios';

const USER = 'user-1';
const adapter = vi.fn<AxiosAdapter>();
const originalAdapter = client.defaults.adapter;

const request = (signal: AbortSignal) =>
  prepareReport({
    module: 'requisitions',
    reportId: 'timeliness',
    reportName: 'Timeliness Report',
    format: 'pdf',
    params: { program: 'p1' },
    signal,
  });

const settled = async (promise: Promise<unknown>) => {
  let outcome: unknown = 'pending';
  promise.then(
    (value) => {
      outcome = value;
    },
    (error) => {
      outcome = error;
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  return outcome;
};

beforeEach(() => {
  adapter.mockReset();
  client.defaults.adapter = adapter;
  useLoginData.setState({
    referenceDataUserId: USER,
    accessToken: 'old',
    isAuthenticated: true,
    expired: true,
  });
});
afterEach(() => {
  client.defaults.adapter = originalAdapter;
  useLoginData.setState({
    referenceDataUserId: null,
    accessToken: null,
    isAuthenticated: false,
    expired: false,
  });
});

it('settles Cancel during a session renewal wait and never sends the report after renewal', async () => {
  const controller = new AbortController();
  const inner = request(controller.signal);
  const operation = abortable(inner, controller.signal);
  expect(await settled(operation)).toBe('pending');
  controller.abort();
  expect(isCancel(await settled(operation))).toBe(true);
  useLoginData.setState({ accessToken: 'new', expired: false });
  expect(isCancel(await settled(inner))).toBe(true);
  expect(adapter).not.toHaveBeenCalled();
});

it('settles Cancel while the file is being inspected and never returns it', async () => {
  useLoginData.setState({ expired: false });
  const inspection = Promise.withResolvers<ArrayBuffer>();
  const blob = new Blob(['%PDF-1.4']);
  blob.slice = () => ({ arrayBuffer: () => inspection.promise }) as unknown as Blob;
  adapter.mockImplementation(async (config) => ({
    data: blob,
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/pdf' },
    config,
  }));
  const controller = new AbortController();
  const inner = request(controller.signal);
  const operation = abortable(inner, controller.signal);
  await waitFor(() => expect(adapter).toHaveBeenCalledOnce());
  const sent = adapter.mock.calls[0]?.[0];
  expect(sent?.timeout).toBe(0);
  expect(sent?.params).toEqual({ program: 'p1' });
  expect(sent?.headers.Authorization).toBe('Bearer old');
  controller.abort();
  expect(isCancel(await settled(operation))).toBe(true);
  inspection.resolve(new TextEncoder().encode('%PDF-1.4').buffer);
  expect(isCancel(await settled(inner))).toBe(true);
});
