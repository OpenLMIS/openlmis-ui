import { describe, expect, it } from 'vitest';
import { loginSearch, safeRedirect } from '@/lib/redirect';

describe('safeRedirect', () => {
  it('keeps a page inside the app, with its search', () => {
    expect(safeRedirect('/administration/users?page=2')).toBe('/administration/users?page=2');
  });

  it.each([
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    'https://evil.example',
    'javascript:alert(1)',
    'administration/users',
    '/login',
    '/login?redirect=/home',
    '',
    undefined,
  ])('sends %s to Home instead', (target) => {
    expect(safeRedirect(target)).toBe('/home');
  });
});

describe('loginSearch', () => {
  it('carries the page along to the sign-in page', () => {
    expect(
      loginSearch({ pathname: '/administration/roles', href: '/administration/roles?page=2' }),
    ).toEqual({
      redirect: '/administration/roles?page=2',
    });
  });

  it('leaves Home out, since signing in lands there anyway', () => {
    expect(loginSearch({ pathname: '/home', href: '/home' })).toEqual({});
  });
});
