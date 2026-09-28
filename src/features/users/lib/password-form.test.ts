import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import {
  defaultPasswordForm,
  passwordChecks,
  passwordErrorKey,
  passwordFormSchema,
  resetEmail,
} from '@/features/users/lib/password-form';

const ada = { username: 'ada', firstName: 'Ada', lastName: 'Lovelace' };

const messages = (values: { method: 'email' | 'manual'; password: string }) =>
  passwordFormSchema(ada)
    .safeParse(values)
    .error?.issues.map((issue) => [issue.path, issue.message]);

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

describe('passwordFormSchema', () => {
  it('asks for nothing when the reset goes by email', () => {
    expect(messages({ method: 'email', password: '' })).toBeUndefined();
  });

  it('reports the first rule a typed password misses', () => {
    expect(messages({ method: 'manual', password: '' })).toEqual([
      [['password'], 'users.password.required'],
    ]);
    expect(messages({ method: 'manual', password: 'ab1' })).toEqual([
      [['password'], 'users.password.error.length'],
    ]);
    expect(messages({ method: 'manual', password: 'v9&kznqG0C2(' })).toEqual([
      [['password'], 'users.password.error.characters'],
    ]);
    expect(messages({ method: 'manual', password: 'abcdefgh' })).toEqual([
      [['password'], 'users.password.error.number'],
    ]);
    expect(messages({ method: 'manual', password: 'Ada2024xyz' })).toEqual([
      [['password'], 'users.password.error.names'],
    ]);
    expect(messages({ method: 'manual', password: 'kznqG0C2vx' })).toBeUndefined();
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

describe('defaultPasswordForm', () => {
  it('starts with the emailed link only when there is an address to send it to', () => {
    expect(defaultPasswordForm('ada@example.org').method).toBe('email');
    expect(defaultPasswordForm(null).method).toBe('manual');
  });

  it('treats a blank stored address as none, so a typed password is asked for', () => {
    expect(resetEmail('  ')).toBeNull();
    expect(defaultPasswordForm(resetEmail('')).method).toBe('manual');
  });
});
