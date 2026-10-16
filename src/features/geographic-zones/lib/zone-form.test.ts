import { describe, expect, it } from 'vitest';
import {
  geographicZonePolicy,
  toZoneBody,
  toZoneFormValues,
  zoneFormSchema,
} from '@/features/geographic-zones/lib/zone-form';

const level = (levelNumber: number) => ({
  id: `level-${levelNumber}`,
  code: `${levelNumber}`,
  name: `Level ${levelNumber}`,
  levelNumber,
});
const levels = [level(1), level(2), level(3)];

const saved = {
  id: 'zone',
  name: 'District',
  code: 'DIST',
  level: level(2),
  parent: { id: 'parent', name: 'Region', code: 'REG', level: level(1) },
  catchmentPopulation: 42,
  longitude: -40.123456789,
  latitude: null,
  boundary: {
    type: 'Polygon',
    coordinates: [
      [
        [1, 2],
        [3, 4],
      ],
    ],
  },
  extraData: { externalId: 'external', nested: { keep: true } },
  opaqueField: { keep: ['unrecognized'] },
};

describe('geographic zone population policy', () => {
  it.each([
    [false, 2, true, true],
    [false, 3, true, false],
    [true, 2, false, true],
    [true, 3, true, false],
  ])('auto=%s, level=%s: edit=%s, visualize=%s', (auto, level, edit, visualize) => {
    expect(geographicZonePolicy({ level: { levelNumber: level } }, levels, auto)).toEqual({
      editable: edit,
      visualizable: visualize,
    });
  });

  it('uses every configured level, even an unused one, rather than parent/child membership', () => {
    const child = { ...saved, parent: saved };
    expect(geographicZonePolicy(saved, levels, true)?.editable).toBe(false);
    expect(geographicZonePolicy(child, levels, true)?.editable).toBe(false);
    const formerlyLowest = { ...saved, level: level(3) };
    expect(geographicZonePolicy(formerlyLowest, levels, true)?.editable).toBe(true);
    expect(
      geographicZonePolicy(formerlyLowest, [...levels, { ...level(3), levelNumber: 4 }], true),
    ).toEqual({ editable: false, visualizable: true });
  });

  it('withholds actions when levels are unresolved or unusable', () => {
    expect(geographicZonePolicy(saved, undefined, false)).toBeNull();
    expect(geographicZonePolicy(saved, [], true)).toBeNull();
    expect(
      geographicZonePolicy(saved, [{ ...level(1), levelNumber: Number.NaN }], true),
    ).toBeNull();
    expect(geographicZonePolicy({ level: {} }, levels, true)).toBeNull();
  });
});

describe('zone population form', () => {
  it('preserves the entire full detail record and replaces only population, including clear and zero', () => {
    for (const [text, expected] of [
      ['', null],
      ['0', 0],
      ['200', 200],
    ] as const) {
      const body = toZoneBody({ catchmentPopulation: text }, saved);
      expect(body).toEqual({ ...saved, catchmentPopulation: expected });
      expect(saved.catchmentPopulation).toBe(42);
    }
  });

  it('configures optional Java-integer population validation without hiding invalid legacy values', () => {
    for (const text of ['', '0', '2147483647']) {
      expect(zoneFormSchema.safeParse({ catchmentPopulation: text }).success).toBe(true);
    }
    for (const text of ['-1', '1.5', '1e3', 'abc', '2147483648']) {
      expect(zoneFormSchema.safeParse({ catchmentPopulation: text }).success).toBe(false);
    }
    expect(toZoneFormValues({ ...saved, catchmentPopulation: -1 }).catchmentPopulation).toBe('-1');
  });
});
