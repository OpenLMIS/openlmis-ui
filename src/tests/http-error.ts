import { AxiosError, AxiosHeaders } from 'axios';

/** An error as Axios throws it for a response with `status`. */
export const httpError = (status: number) =>
  new AxiosError('failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

/** An error as Axios throws it when the request never got an answer, e.g. offline. */
export const networkError = () => new AxiosError('Network Error', AxiosError.ERR_NETWORK);
