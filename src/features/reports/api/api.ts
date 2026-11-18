import { isCancel } from 'axios';
import {
  type ApiBase,
  lookupItems,
  type ReportLookup,
} from '@/features/reports/lib/report-lookups';
import type {
  DashboardReport,
  ReportCategory,
  ReportFormat,
  ReportTemplate,
  TemplateReport,
} from '@/features/reports/lib/types';
import { client } from '@/integrations/axios';
import { basicAuthorization } from '@/lib/basic-auth';
import { fetchReportFile } from '@/lib/fetch-report';
import { getAuthClientCredentials } from '@/lib/runtime-config';
import { SessionEndedError } from '@/lib/session-scope';
import type { Page } from '@/lib/types';

/** Where the shared client sends requests, so template lookups are checked against it. */
export const apiBase = (): ApiBase => ({
  baseURL: client.defaults.baseURL ?? '/api',
  origin: window.location.origin,
});

async function fetchCatalog<T>(path: string, signal?: AbortSignal, params = {}) {
  const { data } = await client.get<Page<T>>(path, { signal, params: { size: 0, ...params } });
  if (data.totalPages > 1 || data.totalElements !== data.content.length) {
    throw new Error('The report catalog response is incomplete');
  }
  return data.content;
}

export const fetchReportCategories = (signal?: AbortSignal) =>
  fetchCatalog<ReportCategory>('/reports/reportCategories', signal);

export const fetchAvailableDashboards = (signal?: AbortSignal) =>
  fetchCatalog<DashboardReport>('/reports/dashboardReports/availableReports', signal, {
    showOnHomePage: false,
  });

/** Drops the compiled template the server sends with every report, so it never reaches the cache. */
function withoutTemplateData<T extends object>(report: T): T {
  const { data: _compiled, ...rest } = report as T & { data?: unknown };
  return rest as T;
}

const templatesPath = (module: string) => `/reports/templates/${encodeURIComponent(module)}`;

export async function fetchTemplateReports(module: string, signal?: AbortSignal) {
  const { data } = await client.get<TemplateReport[]>(templatesPath(module), { signal });
  return data.map(withoutTemplateData);
}

export async function fetchTemplateReport(module: string, id: string, signal?: AbortSignal) {
  const { data } = await client.get<ReportTemplate>(
    `${templatesPath(module)}/${encodeURIComponent(id)}`,
    { signal },
  );
  return withoutTemplateData(data);
}

/** Every record a parameter's choices come from, with parent values as encoded query params. */
export async function fetchParameterOptions(
  lookup: Pick<ReportLookup, 'method' | 'path' | 'body'>,
  params: Record<string, string>,
  signal?: AbortSignal,
) {
  const config = { params, signal };
  const { data } =
    lookup.method === 'POST'
      ? await client.post<unknown>(lookup.path, lookup.body ?? {}, config)
      : await client.get<unknown>(lookup.path, config);
  return lookupItems(data);
}

export const generateReport = (
  module: string,
  id: string,
  format: ReportFormat,
  params: Record<string, string>,
  signal: AbortSignal,
) =>
  fetchReportFile(`${templatesPath(module)}/${encodeURIComponent(id)}/${format}`, params, {
    signal,
    timeout: 0,
  });

/** A Superset guest token for one embedded dashboard; callers keep it in memory only. */
export async function fetchGuestToken(embeddedUuid: string, sentFor: string, signal: AbortSignal) {
  const { data } = await client.get<{ token?: unknown }>('/reports/superset/guest-token', {
    params: { embeddedUuid },
    signal,
    sentFor,
  });
  if (typeof data?.token !== 'string' || !data.token)
    throw new Error('No guest token was returned');
  return data.token;
}

/** Superset's own cookie session: never the app's bearer, and its failures say nothing of the app's connection. */
const SUPERSET_REQUEST = {
  anonymous: true,
  withCredentials: true,
  session: false,
  connectionStatus: false,
  timeout: 20_000,
} as const;

const supersetRedirectUrl = (supersetUrl: string) => `${supersetUrl}/oauth-authorized/openlmis`;

export type SupersetSession = { isAuthorized: boolean; state?: string };

/** Whether the older reporting stack already has a Superset session, and the OAuth state if not. */
export async function checkSupersetSession(
  supersetUrl: string,
  signal: AbortSignal,
): Promise<SupersetSession> {
  const { data } = await client.get<unknown>(`${supersetUrl}/oauth-init/openlmis`, {
    ...SUPERSET_REQUEST,
    params: { redirect_url: supersetRedirectUrl(supersetUrl) },
    signal,
  });
  const session = data as { isAuthorized?: unknown; state?: unknown } | null;
  if (typeof session?.isAuthorized !== 'boolean')
    throw new Error('The reporting service gave no sign-in status');
  return {
    isAuthorized: session.isAuthorized,
    state: typeof session.state === 'string' ? session.state : undefined,
  };
}

export type SupersetSignInStep = 'password' | 'authorize' | 'approve';

export class SupersetSignInError extends Error {
  constructor(
    readonly step: SupersetSignInStep,
    readonly reason: unknown,
  ) {
    super(`Superset sign-in failed at ${step}`);
    this.name = 'SupersetSignInError';
  }
}

async function step<T>(name: SupersetSignInStep, request: Promise<T>) {
  try {
    return await request;
  } catch (error) {
    if (isCancel(error) || error instanceof SessionEndedError) throw error;
    throw new SupersetSignInError(name, error);
  }
}

/** Signs the user in to the older reporting stack through the OpenLMIS OAuth flow legacy uses. */
export async function signInToSuperset({
  supersetUrl,
  username,
  password,
  state,
  signal,
}: {
  supersetUrl: string;
  username: string;
  password: string;
  state: string | undefined;
  signal: AbortSignal;
}) {
  const { clientId, clientSecret } = getAuthClientCredentials();
  if (!clientId || !clientSecret)
    throw new SupersetSignInError('password', new Error('No OAuth client is configured'));
  const user = { Authorization: basicAuthorization(username, password) };
  const authorize = {
    response_type: 'code',
    client_id: 'superset',
    redirect_uri: supersetRedirectUrl(supersetUrl),
  };
  // Checked first, as legacy does, so a wrong password never meets the browser's own Basic prompt.
  await step(
    'password',
    client.post('/oauth/token?grant_type=password', new URLSearchParams({ username, password }), {
      headers: {
        Authorization: basicAuthorization(clientId, clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      session: false,
      signal,
    }),
  );
  await step(
    'authorize',
    client.get('/oauth/authorize', {
      params: { ...authorize, scope: 'read write', state },
      headers: user,
      withCredentials: true,
      session: false,
      signal,
    }),
  );
  if ((await step('authorize', checkSupersetSession(supersetUrl, signal))).isAuthorized) return;
  await step(
    'approve',
    client.post(
      '/oauth/authorize',
      new URLSearchParams({
        authorize: 'Authorize',
        user_oauth_approval: 'true',
        'scope.read': 'true',
        'scope.write': 'true',
      }),
      {
        params: authorize,
        headers: { ...user, 'Content-Type': 'application/x-www-form-urlencoded' },
        withCredentials: true,
        session: false,
        signal,
      },
    ),
  );
  if (!(await step('approve', checkSupersetSession(supersetUrl, signal))).isAuthorized)
    throw new SupersetSignInError('approve', new Error('Superset is still not signed in'));
}

const SUPERSET_LANGUAGES = ['en', 'fr', 'pt'];

/** Superset's own language, as legacy sets it; a failure leaves Superset's default. */
export async function changeSupersetLanguage(
  supersetUrl: string,
  language: string,
  signal: AbortSignal,
) {
  const base = language.split('-')[0];
  const locale = SUPERSET_LANGUAGES.includes(base) ? base : 'en';
  await client.get(`${supersetUrl}/lang/change/${locale}`, { ...SUPERSET_REQUEST, signal });
}
