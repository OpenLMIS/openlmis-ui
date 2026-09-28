import { describe, expect, it } from 'vitest';
import { changePasswordSchema } from '@/features/profile/lib/password-form';

const schema = changePasswordSchema(['ada', 'Ada', 'Lovelace']);

const messages = (password: string, confirm: string) =>
  schema.safeParse({ password, confirm }).error?.issues.map((issue) => [issue.path, issue.message]);

describe('changePasswordSchema', () => {
  it('accepts a valid password typed twice', () => {
    expect(messages('secret12', 'secret12')).toBeUndefined();
  });

  it('checks the password against the auth service rules', () => {
    expect(messages('abc1', 'abc1')).toEqual([[['password'], 'password.too-short']]);
  });

  it("refuses the user's own names", () => {
    expect(messages('lovelace12', 'lovelace12')).toEqual([[['password'], 'password.no-user-data']]);
  });

  it('asks for the confirmation, then for it to match', () => {
    expect(messages('secret12', '')).toEqual([[['confirm'], 'profile.password.confirm-required']]);
    expect(messages('secret12', 'secret13')).toEqual([[['confirm'], 'profile.password.mismatch']]);
  });

  it('reports both fields at once', () => {
    expect(messages('', 'x')).toEqual([
      [['password'], 'password.required'],
      [['confirm'], 'profile.password.mismatch'],
    ]);
  });
});
