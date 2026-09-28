import { describe, expect, it } from 'vitest';
import { safeRedirect } from '@/lib/redirect';

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
