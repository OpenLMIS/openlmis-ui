import { AxiosError, AxiosHeaders } from 'axios';

/** An error as Axios throws it for a response with `status` and, optionally, a body. */
export const httpError = (status: number, data: unknown = {}) =>
  new AxiosError('failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

export const networkError = () => new AxiosError('Network Error', AxiosError.ERR_NETWORK);
