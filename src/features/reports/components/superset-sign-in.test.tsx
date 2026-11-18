import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PageVisibility } from '@/components/shared/page-visibility';
import { useLoginData } from '@/features/auth/store/login-data';
import { DashboardViewer } from '@/features/reports/components/dashboard-viewer';
import type { DashboardReport } from '@/features/reports/lib/types';
import { client } from '@/integrations/axios';
import { renderPage } from '@/test-utils/render-page';

const SUPERSET = 'https://superset.example.org';
const DASHBOARD = `${SUPERSET}/superset/dashboard/7/`;
const oldReport: DashboardReport = { id: 'r1', name: 'Stock', type: 'SUPERSET', url: DASHBOARD };

type Sent = {
  method: string;
  url: string;
  params?: Record<string, unknown>;
  authorization?: string;
  contentType?: string;
  withCredentials?: boolean;
  body?: string;
};
type Reply = (config: InternalAxiosRequestConfig) => unknown;

let sent: Sent[] = [];
let replies: Record<string, Reply>;
const originalAdapter = client.defaults.adapter;

const ok = (data: unknown) => () => data;
const fail = (status?: number) => (config: InternalAxiosRequestConfig) => {
  throw new AxiosError(
    'failed',
    status ? 'ERR_BAD_REQUEST' : 'ERR_NETWORK',
    config,
    undefined,
    status ? ({ status, data: {}, headers: {}, config } as AxiosResponse) : undefined,
  );
};
const route = (config: AxiosRequestConfig) =>
  `${config.method?.toUpperCase()} ${config.url?.replace(SUPERSET, '<superset>')}`;

beforeEach(() => {
  vi.stubEnv('VITE_AUTH_SERVER_CLIENT_ID', 'user-client');
  vi.stubEnv('VITE_AUTH_SERVER_CLIENT_SECRET', 'changeme');
  useLoginData.getState().clearLoginData();
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'ada-id',
    username: 'adá',
    accessToken: 'app-token',
  });
  sent = [];
  let authorized = false;
  replies = {
    'GET <superset>/oauth-init/openlmis': () =>
      authorized ? { isAuthorized: true } : { isAuthorized: false, state: 'st/1+2' },
    'POST /oauth/token?grant_type=password': ok({ access_token: 'discarded' }),
    'GET /oauth/authorize': ok('<form>approve</form>'),
    'POST /oauth/authorize': () => {
      authorized = true;
      return '';
    },
    'GET <superset>/lang/change/en': ok(''),
  };
  client.defaults.adapter = async (config) => {
    sent.push({
      method: config.method?.toUpperCase() ?? '',
      url: config.url ?? '',
      params: config.params,
      authorization: config.headers.Authorization as string | undefined,
      contentType: config.headers.getContentType?.()?.toString(),
      withCredentials: config.withCredentials,
      body: typeof config.data === 'string' ? config.data : config.data?.toString(),
    });
    const reply = replies[route(config)];
    if (!reply) throw new Error(`Unexpected ${route(config)}`);
    return { data: await reply(config), status: 200, statusText: 'OK', headers: {}, config };
  };
});

afterEach(() => {
  client.defaults.adapter = originalAdapter;
  useLoginData.getState().clearLoginData();
  vi.unstubAllEnvs();
});

let setHidden: (hidden: boolean) => void = () => {};
function Harness({ report = oldReport, configured = true }) {
  const [hidden, set] = useState(false);
  setHidden = set;
  return (
    <PageVisibility hidden={hidden}>
      <DashboardViewer
        report={report}
        supersetUrl={configured ? SUPERSET : undefined}
        userId="ada-id"
        username="adá"
      />
    </PageVisibility>
  );
}

const basic = (text: string) =>
  `Basic ${btoa(String.fromCharCode(...new TextEncoder().encode(text)))}`;
const routes = () => sent.map(route);

it('opens an already signed-in Superset dashboard without asking for a password', async () => {
  replies['GET <superset>/oauth-init/openlmis'] = ok({ isAuthorized: true });
  renderPage(<Harness />);

  expect(await screen.findByTitle('Stock')).toHaveAttribute('src', `${DASHBOARD}?standalone=true`);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(routes()).toEqual(['GET <superset>/oauth-init/openlmis', 'GET <superset>/lang/change/en']);
  expect(sent[0]).toMatchObject({
    params: { redirect_url: `${SUPERSET}/oauth-authorized/openlmis` },
    authorization: undefined,
    withCredentials: true,
  });
  expect(sent[1].authorization).toBeUndefined();
});

it('signs in with the password, authorizes and approves Superset, then shows the dashboard', async () => {
  const user = userEvent.setup();
  renderPage(<Harness />);
  const password = 'zażółć &=+%?#:';
  await user.type(await screen.findByLabelText('login.password'), password);
  await user.click(screen.getByRole('button', { name: 'reports.dashboard.sign-in-submit' }));

  expect(await screen.findByTitle('Stock')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(routes()).toEqual([
    'GET <superset>/oauth-init/openlmis',
    'POST /oauth/token?grant_type=password',
    'GET /oauth/authorize',
    'GET <superset>/oauth-init/openlmis',
    'POST /oauth/authorize',
    'GET <superset>/oauth-init/openlmis',
    'GET <superset>/lang/change/en',
  ]);
  const [, token, authorize, , approve] = sent;
  expect(token.authorization).toBe(basic('user-client:changeme'));
  expect(new URLSearchParams(token.body)).toEqual(
    new URLSearchParams({ username: 'adá', password }),
  );
  const redirect = `${SUPERSET}/oauth-authorized/openlmis`;
  expect(authorize).toMatchObject({
    authorization: basic(`adá:${password}`),
    withCredentials: true,
    params: {
      response_type: 'code',
      client_id: 'superset',
      redirect_uri: redirect,
      scope: 'read write',
      state: 'st/1+2',
    },
  });
  expect(approve).toMatchObject({ authorization: basic(`adá:${password}`), withCredentials: true });
  for (const form of [token, approve])
    expect(form.contentType).toMatch(/^application\/x-www-form-urlencoded/);
  expect(Object.fromEntries(new URLSearchParams(approve.body))).toEqual({
    authorize: 'Authorize',
    user_oauth_approval: 'true',
    'scope.read': 'true',
    'scope.write': 'true',
  });
  for (const request of sent.filter(({ url }) => url.startsWith(SUPERSET)))
    expect(request.authorization).toBeUndefined();
  expect(JSON.stringify(sent.map(({ url, params }) => [url, params]))).not.toContain('zażółć');
});

it('clears a wrong password without authorizing it, then signs in with the right one', async () => {
  const user = userEvent.setup();
  const valid = replies['POST /oauth/token?grant_type=password'];
  replies['POST /oauth/token?grant_type=password'] = fail(400);
  renderPage(<Harness />);
  const field = await screen.findByLabelText('login.password');
  await user.type(field, 'wrong');
  await user.click(screen.getByRole('button', { name: 'reports.dashboard.sign-in-submit' }));

  expect(await screen.findByText('session.wrong-password')).toBeInTheDocument();
  expect(field).toHaveValue('');
  expect(screen.queryByTitle('Stock')).not.toBeInTheDocument();
  expect(routes()).not.toContain('GET /oauth/authorize');

  replies['POST /oauth/token?grant_type=password'] = valid;
  await user.type(field, 'right');
  await user.click(screen.getByRole('button', { name: 'reports.dashboard.sign-in-submit' }));
  expect(await screen.findByTitle('Stock')).toBeInTheDocument();
});

it('reports an authorization the server refused without showing an unsigned dashboard', async () => {
  const user = userEvent.setup();
  replies['GET /oauth/authorize'] = fail(401);
  renderPage(<Harness />);
  await user.type(await screen.findByLabelText('login.password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'reports.dashboard.sign-in-submit' }));

  expect(await screen.findByText('reports.dashboard.sign-in-authorize-failed')).toBeInTheDocument();
  expect(screen.queryByTitle('Stock')).not.toBeInTheDocument();
  expect(useLoginData.getState().expired).toBe(false);
});

it.each([
  ['unreachable', fail()],
  ['missing', fail(404)],
  ['not answering sign-in status', ok('<html>')],
])('shows an error, never the frame, when the Superset sign-in check is %s', async (_, reply) => {
  replies['GET <superset>/oauth-init/openlmis'] = reply;
  renderPage(<Harness />);

  expect(await screen.findByRole('alert')).toHaveTextContent('reports.dashboard.unavailable-title');
  expect(screen.queryByTitle('Stock')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('returns to the reports list on Cancel', async () => {
  const user = userEvent.setup();
  const router = renderPage(<Harness />, { path: '/reports/dashboards/r1' });
  await user.click(await screen.findByRole('button', { name: 'dialog.cancel' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/reports'));
});

it('drops a typed password and a pending sign-in when the page hides, then checks afresh', async () => {
  const user = userEvent.setup();
  let release = () => {};
  replies['POST /oauth/token?grant_type=password'] = () =>
    new Promise((resolve) => {
      release = () => resolve({});
    });
  renderPage(<Harness />);
  await user.type(await screen.findByLabelText('login.password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'reports.dashboard.sign-in-submit' }));
  await waitFor(() => expect(routes()).toContain('POST /oauth/token?grant_type=password'));

  act(() => setHidden(true));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  release();
  act(() => setHidden(false));

  expect(await screen.findByLabelText('login.password')).toHaveValue('');
  expect(routes()).not.toContain('GET /oauth/authorize');
  expect(routes().filter((name) => name.endsWith('oauth-init/openlmis'))).toHaveLength(2);
});

it('never opens the frame for a user who changed during sign-in', async () => {
  const user = userEvent.setup();
  replies['GET /oauth/authorize'] = () => {
    useLoginData.getState().setLoginData({
      referenceDataUserId: 'bob-id',
      username: 'bob',
      accessToken: 'bob-token',
    });
    return '';
  };
  renderPage(<Harness />);
  await user.type(await screen.findByLabelText('login.password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'reports.dashboard.sign-in-submit' }));

  await waitFor(() => expect(routes()).toContain('GET /oauth/authorize'));
  expect(screen.queryByTitle('Stock')).not.toBeInTheDocument();
  expect(routes()).toHaveLength(3);
});

it('shows Not Set Up without contacting anything when no Superset address is configured', async () => {
  renderPage(<Harness configured={false} />);
  expect(await screen.findByText('reports.dashboard.not-set-up-title')).toBeInTheDocument();
  expect(sent).toEqual([]);
});

it('frames another provider directly, never asking for a password', async () => {
  const url = 'https://app.powerbi.com/view?r=abc';
  renderPage(<Harness report={{ id: 'p1', name: 'Sales', type: 'POWERBI', url }} />);
  expect(await screen.findByTitle('Sales')).toHaveAttribute('src', url);
  expect(sent).toEqual([]);
});
