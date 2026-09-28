import { describe, expect, it } from 'vitest';
import {
  defaultPasswordForm,
  passwordFormSchema,
  resetEmail,
} from '@/features/users/lib/password-form';

const ada = { username: 'ada', firstName: 'Ada', lastName: 'Lovelace' };

const messages = (values: { method: 'email' | 'manual'; password: string }) =>
  passwordFormSchema(ada)
    .safeParse(values)
    .error?.issues.map((issue) => [issue.path, issue.message]);

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
