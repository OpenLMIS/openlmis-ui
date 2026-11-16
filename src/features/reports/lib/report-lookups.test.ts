import { describe, expect, it } from 'vitest';
import {
  IncompleteLookupError,
  lookupItems,
  lookupPath,
  projectOptions,
  toLookup,
} from '@/features/reports/lib/report-lookups';
import { reportParameter } from '@/test-utils/report-templates';

const SAME_ORIGIN = { baseURL: '/api', origin: 'https://lmis.example' };

describe('lookupPath', () => {
  it('keeps a root-relative API path and removes the API prefix', () => {
    expect(lookupPath('/api/facilities', SAME_ORIGIN)).toBe('/facilities');
    expect(lookupPath('/api/geographicZones/search', SAME_ORIGIN)).toBe('/geographicZones/search');
    expect(
      lookupPath('/api/programs', {
        baseURL: 'https://api.example/api',
        origin: SAME_ORIGIN.origin,
      }),
    ).toBe('/programs');
  });

  it.each([
    'https://reports.invalid/api/facilities',
    '//reports.invalid/api/facilities',
    '/api//reports.invalid/choices',
    '/api///reports.invalid/choices',
    '/api/\\reports.invalid/choices',
    '/api/facilities\\..\\users',
    '/facilities',
    '/apifacilities',
    '/api',
    '/api/',
    '/api/../users',
    '/api/facilities/../../users',
    '/api/./facilities',
    '/api/%2e%2e/users',
    '/api/%2F%2Freports.invalid',
    '/api/facilities?size=1',
    '/api/facilities#x',
    ' /api/facilities',
    '/api/facilities\n',
    'javascript:alert(1)',
  ])('refuses %j before any request', (expression) => {
    expect(lookupPath(expression, SAME_ORIGIN)).toBeNull();
  });

  it('stays under the configured API base, wherever it is served', () => {
    expect(
      lookupPath('/api/facilities', { baseURL: '//other.example/api', origin: SAME_ORIGIN.origin }),
    ).toBe('/facilities');
    expect(lookupPath('/api/facilities', { baseURL: '/api/', origin: SAME_ORIGIN.origin })).toBe(
      '/facilities',
    );
  });
});

describe('toLookup', () => {
  it('reads with GET unless the template asks for POST, and refuses other methods', () => {
    const facilities = reportParameter({
      name: 'facility',
      selectExpression: '/api/facilities',
      selectProperty: 'name',
    });
    expect(toLookup(facilities, SAME_ORIGIN)).toMatchObject({ method: 'GET', path: '/facilities' });
    expect(toLookup({ ...facilities, selectMethod: 'PUT' }, SAME_ORIGIN)).toBeNull();
    expect(toLookup({ ...facilities, selectMethod: 'DELETE' }, SAME_ORIGIN)).toBeNull();
    expect(toLookup({ ...facilities, selectProperty: null }, SAME_ORIGIN)).toBeNull();
  });

  it('sends the level 2 zone search whenever a body is stored, as legacy does', () => {
    const zones = reportParameter({
      name: 'district',
      selectExpression: '/api/geographicZones/search',
      selectMethod: 'POST',
      selectProperty: 'id',
      displayProperty: 'name',
    });
    expect(toLookup({ ...zones, selectBody: '{"levelNumber": "3"}' }, SAME_ORIGIN)?.body).toEqual({
      levelNumber: '2',
    });
    expect(toLookup(zones, SAME_ORIGIN)?.body).toEqual({});
    expect(toLookup({ ...zones, selectBody: '{level' }, SAME_ORIGIN)).toBeNull();
  });
});

describe('lookupItems', () => {
  it('accepts a list or a complete page, including an empty page', () => {
    expect(lookupItems([{ id: 'a' }])).toEqual([{ id: 'a' }]);
    expect(lookupItems({ content: [{ id: 'a' }], totalElements: 1, totalPages: 1 })).toEqual([
      { id: 'a' },
    ]);
    expect(lookupItems({ content: [], totalElements: 0, totalPages: 0 })).toEqual([]);
  });

  it('refuses a page that leaves records out', () => {
    expect(() => lookupItems({ content: [{ id: 'a' }], totalElements: 2, totalPages: 2 })).toThrow(
      IncompleteLookupError,
    );
    expect(() => lookupItems({ content: [{ id: 'a' }], totalElements: 1, totalPages: 2 })).toThrow(
      IncompleteLookupError,
    );
    expect(() => lookupItems({ items: [] })).toThrow();
  });
});

describe('projectOptions', () => {
  const programs = [
    { id: 'p1', name: 'Family Planning' },
    { id: 'p2', name: 'Essential Meds' },
  ];

  it('submits names or ids exactly as the template asks, in the order returned', () => {
    expect(projectOptions(programs, 'name', 'name')).toEqual([
      { value: 'Family Planning', label: 'Family Planning' },
      { value: 'Essential Meds', label: 'Essential Meds' },
    ]);
    expect(projectOptions(programs, 'id', 'name')).toEqual([
      { value: 'p1', label: 'Family Planning' },
      { value: 'p2', label: 'Essential Meds' },
    ]);
    expect(projectOptions(programs, 'name', null).map(({ label }) => label)).toEqual([
      'Family Planning',
      'Essential Meds',
    ]);
    expect(
      projectOptions(
        [{ fullProductName: 'Acetylsalicylic Acid' }],
        'fullProductName',
        'fullProductName',
      ),
    ).toEqual([{ value: 'Acetylsalicylic Acid', label: 'Acetylsalicylic Acid' }]);
  });

  it('drops empty values, keeps zero and false, and keeps the first of a repeated value', () => {
    expect(
      projectOptions(
        [
          { code: null },
          { code: '' },
          {},
          { code: 0, name: 'Zero' },
          { code: false, name: 'No' },
          { code: 'A', name: 'First A' },
          { code: 'A', name: 'Second A' },
          { code: { nested: true } },
          'plain',
        ],
        'code',
        'name',
      ),
    ).toEqual([
      { value: '0', label: 'Zero' },
      { value: 'false', label: 'No' },
      { value: 'A', label: 'First A' },
    ]);
  });
});
