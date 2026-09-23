import { describe, expect, it } from 'vitest';
import {
  getNavTrail,
  getTextDirection,
  isNavParent,
  LIVE_NAV_GROUPS,
  SUPPORTED_LANGUAGES,
} from '@/lib/config';

describe('getTextDirection', () => {
  it('returns the configured direction for a supported language', () => {
    expect(getTextDirection('en')).toBe('ltr');
    expect(getTextDirection('pt')).toBe('ltr');
    expect(getTextDirection('ar')).toBe('rtl');
  });

  it('resolves regional variants through their base language', () => {
    expect(getTextDirection('ar-EG')).toBe('rtl');
    expect(getTextDirection('pt-BR')).toBe('ltr');
  });

  it('falls back to ltr for unknown or missing languages', () => {
    expect(getTextDirection('he')).toBe('ltr');
    expect(getTextDirection(undefined)).toBe('ltr');
    expect(getTextDirection('')).toBe('ltr');
  });

  it('declares a direction for every supported language', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(['ltr', 'rtl']).toContain(lang.dir);
    }
  });
});

describe('getNavTrail', () => {
  it('returns a top-level page on its own', () => {
    expect(getNavTrail('/home')).toEqual([{ titleKey: 'home.title', to: '/home' }]);
  });

  it('leads a nested page with its section, which has no page of its own', () => {
    expect(getNavTrail('/administration/users')).toEqual([
      { titleKey: 'nav.administration' },
      { titleKey: 'nav.administration.users', to: '/administration/users' },
    ]);
  });

  it('is empty for a path outside the nav', () => {
    expect(getNavTrail('/login')).toEqual([]);
  });
});

describe('LIVE_NAV_GROUPS', () => {
  const items = LIVE_NAV_GROUPS.flatMap((group) => group.items);
  const links = items.flatMap((item) => (isNavParent(item) ? item.items : [item]));

  it('leaves out pages that are not migrated yet', () => {
    expect(links.map((link) => String(link.to))).not.toContain('#');
  });

  it('drops a section once none of its pages is live', () => {
    expect(items.map((item) => item.titleKey)).not.toContain('nav.reports');
    expect(items.map((item) => item.titleKey)).toContain('nav.administration');
  });

  it('drops a group left with nothing in it', () => {
    expect(LIVE_NAV_GROUPS.every((group) => group.items.length > 0)).toBe(true);
  });
});
