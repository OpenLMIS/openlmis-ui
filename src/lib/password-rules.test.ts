import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import {
  passwordChecks,
  passwordErrorKey,
  passwordIssue,
  passwordRules,
} from '@/lib/password-rules';

const ada = { username: 'ada', firstName: 'Ada', lastName: 'Lovelace' };

describe('passwordChecks', () => {
  it('passes a password that meets every rule the auth service checks', () => {
    expect(passwordChecks('kznqG0C2vx', ada)).toEqual({
      length: true,
      characters: true,
      number: true,
      names: true,
    });
  });

  it('takes 8 to 72 characters', () => {
    expect(passwordChecks('kznq0C2', ada).length).toBe(false);
    expect(passwordChecks('kznqG0C2', ada).length).toBe(true);
    expect(passwordChecks(`k1${'z'.repeat(70)}`, ada).length).toBe(true);
    expect(passwordChecks(`k1${'z'.repeat(71)}`, ada).length).toBe(false);
  });

  it('takes only the letters A to Z and digits', () => {
    expect(passwordChecks('v9&kznqG0C2(', ada).characters).toBe(false);
    expect(passwordChecks('kznq G0C2', ada).characters).toBe(false);
    expect(passwordChecks('kznqé0C2x', ada).characters).toBe(false);
    expect(passwordChecks('', ada).characters).toBe(false);
  });

  it('needs a digit', () => {
    expect(passwordChecks('kznqGxCvx', ada).number).toBe(false);
  });

  it('rejects the username or a name anywhere in it, ignoring case', () => {
    expect(passwordChecks('xADAx2024', ada).names).toBe(false);
    expect(passwordChecks('lovelace12', ada).names).toBe(false);
    expect(passwordChecks('', ada).names).toBe(false);
  });

  it('skips a name the user does not have', () => {
    expect(passwordChecks('kznqG0C2vx', { ...ada, lastName: ' ' }).names).toBe(true);
  });
});

describe('passwordRules', () => {
  it('checks the names only when it knows whose password it is', () => {
    expect(passwordRules(ada)).toEqual(['length', 'characters', 'number', 'names']);
    expect(passwordRules()).toEqual(['length', 'characters', 'number']);
  });
});

describe('passwordIssue', () => {
  it('asks for a password, then reports the first rule it misses', () => {
    expect(passwordIssue('', ada)).toBe('users.password.required');
    expect(passwordIssue('ab1', ada)).toBe('users.password.error.length');
    expect(passwordIssue('v9&kznqG0C2(', ada)).toBe('users.password.error.characters');
    expect(passwordIssue('abcdefgh', ada)).toBe('users.password.error.number');
    expect(passwordIssue('Ada2024xyz', ada)).toBe('users.password.error.names');
    expect(passwordIssue('kznqG0C2vx', ada)).toBeUndefined();
  });

  it('leaves the names out for a password whose owner is unknown', () => {
    expect(passwordIssue('', undefined)).toBe('users.password.required');
    expect(passwordIssue('abcdefgh', undefined)).toBe('users.password.error.number');
    expect(passwordIssue('Ada2024xyz', undefined)).toBeUndefined();
  });
});

describe('passwordErrorKey', () => {
  const rejected = (data: unknown) =>
    new AxiosError('Bad Request', '400', undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data,
    });

  it('words the strength check in our own translated text', () => {
    const error = rejected({
      messageKey: 'users.passwordReset.tooWeak',
      message: 'Provided password is too weak. Suggestions: Add another word or two.',
    });

    expect(passwordErrorKey(error)).toBe('users.password.error.too-weak');
  });

  it('leaves any other error to the server message', () => {
    expect(
      passwordErrorKey(rejected({ messageKey: 'Password size must be between 8 and 72.' })),
    ).toBeUndefined();
    expect(passwordErrorKey(new Error('offline'))).toBeUndefined();
  });
});
