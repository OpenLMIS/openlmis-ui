import { describe, expect, it } from 'vitest';
import { defaultPasswordForm, passwordFormSchema } from '@/features/users/lib/password-form';

const messages = (values: { method: 'email' | 'manual'; password: string }) =>
  passwordFormSchema.safeParse(values).error?.issues.map((issue) => [issue.path, issue.message]);

describe('passwordFormSchema', () => {
  it('asks for nothing when the reset goes by email', () => {
    expect(messages({ method: 'email', password: '' })).toBeUndefined();
  });

  it('checks a typed password against the auth service rule', () => {
    expect(messages({ method: 'manual', password: '' })).toEqual([
      [['password'], 'users.password.required'],
    ]);
    expect(messages({ method: 'manual', password: 'abc1' })).toEqual([
      [['password'], 'users.password.too-short'],
    ]);
    expect(messages({ method: 'manual', password: 'abcdefgh' })).toEqual([
      [['password'], 'users.password.needs-number'],
    ]);
    expect(messages({ method: 'manual', password: 'abcdefg1' })).toBeUndefined();
  });
});

describe('defaultPasswordForm', () => {
  it('starts with the emailed link only when there is an address to send it to', () => {
    expect(defaultPasswordForm(true).method).toBe('email');
    expect(defaultPasswordForm(false).method).toBe('manual');
  });
});
