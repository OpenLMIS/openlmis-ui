import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionEndedError } from '@/features/auth/lib/session';
import { syncOtherTab, useLoginData } from '@/features/auth/store/login-data';
import { client } from '@/integrations/axios';

const ada = { referenceDataUserId: 'ada-id', username: 'ada', accessToken: 'old-token' };

/** Answers like the server: 401 for any bearer but `valid`, and records every request it got. */
function serve(valid: string, hold?: Promise<void>) {
  const sent: string[] = [];
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const authorization = String(config.headers.Authorization ?? '');
    sent.push(`${config.url} ${authorization}`);
    if (hold) await hold;
    const response = { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    if (authorization.startsWith('Bearer ') && authorization !== `Bearer ${valid}`) {
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
        ...response,
        status: 401,
        statusText: 'Unauthorized',
      });
    }
    return response;
  });
  client.defaults.adapter = adapter;
  return { sent, adapter };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  useLoginData.getState().clearLoginData();
  useLoginData.getState().setLoginData(ada);
});

afterEach(() => {
  client.defaults.adapter = undefined;
});

describe('client', () => {
  it('refuses a request retained for a different user before sending it', async () => {
    const { sent } = serve('old-token');

    await expect(
      client.delete('/validDestinations/old-draft', {
        sentFor: 'previous-user-id',
      }),
    ).rejects.toBeInstanceOf(SessionEndedError);

    expect(sent).toEqual([]);
  });

  it('does not send a queued write after a synchronous user switch', async () => {
    const { sent } = serve('alan-token');
    const request = client.put('/users', { draft: 'ada' });
    useLoginData.getState().setLoginData({
      referenceDataUserId: 'alan-id',
      username: 'alan',
      accessToken: 'alan-token',
    });
    await expect(request).rejects.toBeInstanceOf(SessionEndedError);
    expect(sent).toEqual([]);
  });

  it('rejects a stale successful read before a save can continue as another user', async () => {
    let release = () => {};
    const sent: string[] = [];
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    client.defaults.adapter = async (config) => {
      sent.push(`${config.url} ${config.headers.Authorization}`);
      if (config.url === '/latest') await hold;
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    };
    const saving = client.get('/latest').then(() => client.put('/users', { draft: 'ada' }));
    await flush();
    useLoginData.getState().setLoginData({
      referenceDataUserId: 'alan-id',
      username: 'alan',
      accessToken: 'alan-token',
    });
    release();
    await expect(saving).rejects.toBeInstanceOf(SessionEndedError);
    expect(sent).toEqual(['/latest Bearer old-token']);
  });

  it.each(['token-first', 'id-first'])(
    'holds legacy credentials during a %s user switch',
    async (order) => {
      localStorage.setItem('openlmis.ACCESS_TOKEN', ada.accessToken);
      localStorage.setItem('openlmis.USER_ID', ada.referenceDataUserId);
      localStorage.setItem('openlmis.USERNAME', ada.username);
      useLoginData.getState().setLoginData(ada, 'legacy');
      const { sent } = serve('alan-token');
      const changes =
        order === 'token-first'
          ? [
              ['ACCESS_TOKEN', 'alan-token'],
              ['USER_ID', 'alan-id'],
            ]
          : [
              ['USER_ID', 'alan-id'],
              ['ACCESS_TOKEN', 'alan-token'],
            ];
      const [first, second] = changes;
      const request = client.put('/users', { draft: 'ada' }).then(
        () => null,
        (error: unknown) => error,
      );
      localStorage.setItem(`openlmis.${first[0]}`, first[1]);
      await syncOtherTab(`openlmis.${first[0]}`);
      await flush();
      const intermediate = { ...useLoginData.getState() };
      localStorage.setItem(`openlmis.${second[0]}`, second[1]);
      localStorage.setItem('openlmis.USERNAME', 'alan');
      await syncOtherTab(`openlmis.${second[0]}`);
      useLoginData.getState().clearLoginData();
      expect(await request).toBeInstanceOf(SessionEndedError);
      expect(intermediate.expired).toBe(true);
      expect(sent).toEqual([]);
    },
  );

  it('sends the current token', async () => {
    const { sent } = serve('old-token');

    await client.get('/users/ada-id');

    expect(sent).toEqual(['/users/ada-id Bearer old-token']);
  });

  it('keeps a request its own Authorization, as signing in does', async () => {
    const { sent } = serve('old-token');

    await client.post('/oauth/token', {}, { headers: { Authorization: 'Basic abc' } });

    expect(sent).toEqual(['/oauth/token Basic abc']);
  });

  it('expires the session once for many refusals and resends each after signing in again', async () => {
    const { sent } = serve('new-token');

    const requests = ['/a', '/b', '/c'].map((url) => client.get(url));
    await flush();

    expect(useLoginData.getState().expired).toBe(true);
    useLoginData.getState().setLoginData({ ...ada, accessToken: 'new-token' });
    await Promise.all(requests);

    expect(sent.filter((line) => line.endsWith('Bearer new-token')).sort()).toEqual([
      '/a Bearer new-token',
      '/b Bearer new-token',
      '/c Bearer new-token',
    ]);
  });

  it('holds new requests while the session is expired instead of sending them', async () => {
    const { sent } = serve('new-token');
    useLoginData.getState().expireSession();

    const request = client.get('/later');
    await flush();

    expect(sent).toEqual([]);
    useLoginData.getState().setLoginData({ ...ada, accessToken: 'new-token' });
    await request;
    expect(sent).toEqual(['/later Bearer new-token']);
  });

  it('resends a refusal of an older token rather than expiring the newer session', async () => {
    let answer = () => {};
    const { sent } = serve(
      'new-token',
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const request = client.get('/slow');
    await flush();
    useLoginData.getState().setLoginData({ ...ada, accessToken: 'new-token' });
    answer();

    await request;

    expect(useLoginData.getState().expired).toBe(false);
    expect(sent).toEqual(['/slow Bearer old-token', '/slow Bearer new-token']);
  });

  it('never opens the session prompt for a request that manages its own session', async () => {
    serve('something-else');

    await expect(
      client.post('/users/auth/logout', undefined, { session: false }),
    ).rejects.toThrow();

    expect(useLoginData.getState().expired).toBe(false);
  });

  it('sends an anonymous request with no token, even while signed in', async () => {
    const { sent } = serve('old-token');

    await client.post('/users/auth/forgotPassword', undefined, { anonymous: true });

    expect(sent).toEqual(['/users/auth/forgotPassword ']);
  });

  it('sends an anonymous request at once while the session is expired', async () => {
    const { sent } = serve('new-token');
    useLoginData.getState().expireSession();

    await client.post('/users/auth/changePassword', {}, { anonymous: true });

    expect(sent).toEqual(['/users/auth/changePassword ']);
  });

  it('never expires the session over a refused anonymous request', async () => {
    client.defaults.adapter = async (config) => {
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
        data: {},
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config,
      });
    };

    await expect(
      client.post('/users/auth/changePassword', {}, { anonymous: true }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(useLoginData.getState().expired).toBe(false);
  });

  it('fails the waiting requests when the user signs out instead', async () => {
    serve('new-token');
    const request = client.get('/a');
    await flush();

    useLoginData.getState().clearLoginData();

    await expect(request).rejects.toBeInstanceOf(SessionEndedError);
  });

  it('never resends a refusal of one user as another who has signed in since', async () => {
    let answer = () => {};
    const { sent } = serve(
      'alan-token',
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const request = client.put('/users');
    await flush();
    useLoginData.getState().setLoginData({
      referenceDataUserId: 'alan-id',
      username: 'alan',
      accessToken: 'alan-token',
    });
    answer();

    await expect(request).rejects.toBeInstanceOf(SessionEndedError);
    expect(sent).toEqual(['/users Bearer old-token']);
  });

  it('expires again when the resent request is refused too', async () => {
    const { adapter } = serve('never');
    const request = client.get('/a');
    await flush();
    useLoginData.getState().setLoginData({ ...ada, accessToken: 'still-bad' });
    await flush();

    expect(useLoginData.getState().expired).toBe(true);
    expect(adapter).toHaveBeenCalledTimes(2);
    useLoginData.getState().clearLoginData();
    await expect(request).rejects.toBeInstanceOf(SessionEndedError);
  });

  it.each([403, 500])('passes a %i through without asking to sign in again', async (status) => {
    client.defaults.adapter = async (config) => {
      throw new AxiosError('Refused', 'ERR_BAD_RESPONSE', config, undefined, {
        data: {},
        status,
        statusText: '',
        headers: {},
        config,
      });
    };

    await expect(client.get('/users')).rejects.toMatchObject({ response: { status } });
    expect(useLoginData.getState().expired).toBe(false);
  });

  it('passes a 401 through when nobody is signed in, since there is no session to renew', async () => {
    useLoginData.getState().clearLoginData();
    serve('new-token');

    await expect(
      client.get('/users', { headers: { Authorization: 'Bearer stale' } }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(useLoginData.getState()).toMatchObject({ isAuthenticated: false, expired: false });
  });
});
