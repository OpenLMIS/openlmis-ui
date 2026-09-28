import { describe, expect, it } from 'vitest';
import { passwordIssue } from '@/lib/password-rules';

describe('passwordIssue', () => {
  it('accepts 8 to 72 letters and numbers with a number among them', () => {
    expect(passwordIssue('secret12')).toBeUndefined();
    expect(passwordIssue(`a1${'b'.repeat(70)}`)).toBeUndefined();
  });

  it('asks for a password first', () => {
    expect(passwordIssue('')).toBe('password.required');
  });

  it('refuses spaces before anything else', () => {
    expect(passwordIssue('secret 12')).toBe('password.no-spaces');
    expect(passwordIssue(' ')).toBe('password.no-spaces');
  });

  it('refuses a password too short or too long', () => {
    expect(passwordIssue('abc1')).toBe('password.too-short');
    expect(passwordIssue(`a1${'b'.repeat(71)}`)).toBe('password.too-long');
  });

  it('refuses symbols and letters outside A to Z, as the server does', () => {
    expect(passwordIssue('secret12!')).toBe('password.letters-digits');
    expect(passwordIssue('sécret123')).toBe('password.letters-digits');
  });

  it('asks for a number', () => {
    expect(passwordIssue('secretpassword')).toBe('password.needs-number');
  });

  it("refuses the user's own names in any case, and ignores missing ones", () => {
    expect(passwordIssue('myADA1234', ['ada', 'Lovelace'])).toBe('password.no-user-data');
    expect(passwordIssue('lovelace99', ['ada', 'Lovelace'])).toBe('password.no-user-data');
    expect(passwordIssue('secret12', ['', null, undefined])).toBeUndefined();
  });
});
