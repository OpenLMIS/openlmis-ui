import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import {
  forgotErrorKey,
  forgotPasswordSchema,
  isResetToken,
  linkProblem,
  resetErrorKey,
} from '@/features/auth/lib/password-reset';
import { httpError, networkError } from '@/tests/http-error';

const rejected = (status: number, data: unknown) =>
  new AxiosError('failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

const emailMessages = (email: string) =>
  forgotPasswordSchema.safeParse({ email }).error?.issues.map((issue) => issue.message);

describe('forgotPasswordSchema', () => {
  it('asks for an address, then for a valid one', () => {
    expect(emailMessages('')).toEqual(['forgot-password.email-required']);
    expect(emailMessages('   ')).toEqual(['forgot-password.email-required']);
    expect(emailMessages('ada')).toEqual(['forgot-password.email-invalid']);
  });

  it('takes a valid address without the spaces around it', () => {
    expect(forgotPasswordSchema.parse({ email: ' ada@example.org ' })).toEqual({
      email: 'ada@example.org',
    });
  });
});

describe('forgotErrorKey', () => {
  it('names a lost connection, too many attempts, and anything else', () => {
    expect(forgotErrorKey(networkError())).toBe('session.cannot-connect');
    expect(forgotErrorKey(httpError(429))).toBe('forgot-password.too-many-attempts');
    expect(forgotErrorKey(httpError(500))).toBe('forgot-password.error');
  });
});

describe('isResetToken', () => {
  it('takes only the shape of token the server sends', () => {
    expect(isResetToken('7a3c9f0e-1b2d-4c5e-8f9a-0b1c2d3e4f5a')).toBe(true);
    expect(isResetToken('7A3C9F0E-1B2D-4C5E-8F9A-0B1C2D3E4F5A')).toBe(true);
    expect(isResetToken('not-a-token')).toBe(false);
    expect(isResetToken('7a3c9f0e-1b2d-4c5e-8f9a-0b1c2d3e4f5')).toBe(false);
  });
});

describe('linkProblem', () => {
  it('tells an expired link from one that never worked or was used', () => {
    expect(linkProblem(rejected(400, { messageKey: 'auth.error.token.expired' }))).toBe('expired');
    expect(linkProblem(rejected(400, { messageKey: 'auth.error.token.invalid' }))).toBe('invalid');
  });

  it('leaves any other failure to the form', () => {
    expect(linkProblem(rejected(400, { messageKey: 'auth.error.fieldRequired' }))).toBeUndefined();
    expect(linkProblem(httpError(500))).toBeUndefined();
    expect(linkProblem(networkError())).toBeUndefined();
  });
});

describe('resetErrorKey', () => {
  it('names a lost connection, and anything else', () => {
    expect(resetErrorKey(networkError())).toBe('session.cannot-connect');
    expect(resetErrorKey(httpError(500))).toBe('reset-password.error');
  });
});
