import { describe, expect, it, vi } from 'vitest';
import { type Gs1Error, parseGs1 } from '@/lib/gs1/parse-gs1';

const GS = '\u001D';
const GTIN = '05890123456786';
const PRODUCT = `01${GTIN}`;

describe('parseGs1', () => {
  it.each(['', ']d2', ']C1', ']e0', ']Q3'])('accepts prefix %j', (prefix) => {
    expect(parseGs1(`${prefix}${PRODUCT}1727123110ABC123${GS}21SER456`)).toMatchObject({
      ok: true,
      gtin: GTIN,
      lotCode: 'ABC123',
      expiry: '2027-12-31',
      serial: 'SER456',
      warnings: [],
      unparsed: {},
    });
  });

  it('reads identifiers in any order', () => {
    expect(parseGs1(`]d21727123110ABC123${GS}${PRODUCT}`)).toMatchObject({
      ok: true,
      gtin: GTIN,
      lotCode: 'ABC123',
      expiry: '2027-12-31',
    });
  });

  it('leaves absent optional identifiers undefined', () => {
    const result = parseGs1(PRODUCT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lotCode).toBeUndefined();
      expect(result.expiry).toBeUndefined();
      expect(result.serial).toBeUndefined();
    }
  });

  it.each(['00000096385074', '00036000291452', '05901234123457', GTIN])(
    'preserves the padded GTIN %s',
    (gtin) => {
      expect(parseGs1(`01${gtin}`)).toMatchObject({ ok: true, gtin });
    },
  );

  it.each([
    [`${PRODUCT}10ABC123`, 'ABC123', undefined],
    [`${PRODUCT}10ABC123${GS}21S1`, 'ABC123', 'S1'],
    [`${GS}${PRODUCT}10ABC123${GS}`, 'ABC123', undefined],
    [`${PRODUCT}10ABC123${GS}${GS}21S1${GS}`, 'ABC123', 'S1'],
  ])('terminates variable elements at GS or end: %j', (raw, lotCode, serial) => {
    const result = parseGs1(raw);
    expect(result).toMatchObject({ ok: true, lotCode });
    if (result.ok) expect(result.serial).toBe(serial);
  });

  it.each<[string, Gs1Error]>([
    ['', 'EMPTY_INPUT'],
    ['HELLO WORLD', 'MALFORMED_ELEMENT_STRING'],
    ['(01)05890123456786', 'MALFORMED_ELEMENT_STRING'],
    [']d2', 'NO_APPLICATION_IDENTIFIERS'],
    [`]d2${GS}`, 'NO_APPLICATION_IDENTIFIERS'],
    ['10ABC123', 'MISSING_GTIN'],
    ['0105890123456', 'TRUNCATED_ELEMENT_STRING'],
    ['0196385074', 'TRUNCATED_ELEMENT_STRING'],
    ['96385074', 'MISSING_GTIN'],
    ['010589012345678A', 'INVALID_GTIN'],
    ['0105890123456787', 'INVALID_GTIN_CHECK_DIGIT'],
    [`${PRODUCT}17271301`, 'INVALID_EXPIRATION_DATE'],
    [`${PRODUCT}17270001`, 'INVALID_EXPIRATION_DATE'],
    [`${PRODUCT}17270230`, 'INVALID_EXPIRATION_DATE'],
    [`${PRODUCT}17270229`, 'INVALID_EXPIRATION_DATE'],
    [`${PRODUCT}17270431`, 'INVALID_EXPIRATION_DATE'],
    [`${PRODUCT}1727AA01`, 'INVALID_EXPIRATION_DATE'],
    [`${PRODUCT}172701`, 'TRUNCATED_ELEMENT_STRING'],
    [`${PRODUCT}10`, 'TRUNCATED_ELEMENT_STRING'],
    [`${PRODUCT}21${GS}`, 'TRUNCATED_ELEMENT_STRING'],
    [`${PRODUCT}10${'A'.repeat(21)}`, 'VALUE_TOO_LONG'],
    [`${PRODUCT}21${'S'.repeat(21)}`, 'VALUE_TOO_LONG'],
    [`${PRODUCT}10AB~CD`, 'INVALID_LOT_CODE'],
    [`${PRODUCT}10AB CD`, 'INVALID_LOT_CODE'],
    [`${PRODUCT}10café`, 'INVALID_LOT_CODE'],
    [`${PRODUCT}21SER#456`, 'INVALID_SERIAL'],
    [`${PRODUCT}21SER 456`, 'INVALID_SERIAL'],
    [`${PRODUCT}390${GS}10LOT1`, 'MALFORMED_ELEMENT_STRING'],
    [`${PRODUCT}112701${GS}3010LOT1`, 'MALFORMED_ELEMENT_STRING'],
    [`01${GTIN.slice(0, 5)}${GS}${GTIN.slice(6)}`, 'MALFORMED_ELEMENT_STRING'],
    [`${PRODUCT}91`, 'TRUNCATED_ELEMENT_STRING'],
    [`${PRODUCT}310300`, 'TRUNCATED_ELEMENT_STRING'],
    [`${PRODUCT}2`, 'MALFORMED_ELEMENT_STRING'],
  ])('rejects %j as %s', (raw, error) => {
    expect(parseGs1(raw, { currentYear: 2026 })).toEqual({ ok: false, error });
  });

  it('handles empty input passed by an untyped caller', () => {
    expect(parseGs1(null as unknown as string)).toEqual({ ok: false, error: 'EMPTY_INPUT' });
  });

  it.each([
    `${PRODUCT}${PRODUCT}`,
    `${PRODUCT}10ABC${GS}10DEF`,
    `${PRODUCT}1727010117280101`,
    `${PRODUCT}21ABC${GS}21DEF`,
  ])('rejects a duplicate extracted identifier: %j', (raw) => {
    expect(parseGs1(raw)).toEqual({ ok: false, error: 'DUPLICATE_APPLICATION_IDENTIFIER' });
  });

  it.each(['10', '21'])('accepts one through twenty GS1 characters in AI %s', (ai) => {
    for (const value of ['A', 'A'.repeat(20), '!"%&\'()*+,-./:;<=>?', 'AZaz_09']) {
      const result = parseGs1(`${PRODUCT}${ai}${value}`);
      expect(result).toMatchObject({ ok: true, [ai === '10' ? 'lotCode' : 'serial']: value });
    }
  });

  it.each([
    ['00', 18],
    ['02', 14],
    ['03', 14],
    ['04', 16],
    ['11', 6],
    ['12', 6],
    ['13', 6],
    ['14', 6],
    ['15', 6],
    ['16', 6],
    ['18', 6],
    ['19', 6],
    ['20', 2],
    ['3103', 6],
    ['3200', 6],
    ['3300', 6],
    ['3400', 6],
    ['3500', 6],
    ['3600', 6],
    ['410', 13],
  ])('skips predefined AI %s without a separator', (ai, length) => {
    const value = '0'.repeat(Number(length));
    expect(parseGs1(`${ai}${value}${PRODUCT}10LOT1`)).toMatchObject({
      ok: true,
      gtin: GTIN,
      lotCode: 'LOT1',
      unparsed: { [ai]: value },
      warnings: ['UNKNOWN_APPLICATION_IDENTIFIER'],
    });
  });

  it.each([
    '91',
    '240',
    '241',
    '250',
    '400',
    '420',
    '710',
    '716',
    '3900',
    '4300',
    '7000',
    '7200',
    '8000',
    '8100',
    '8200',
  ])('reads the full unknown AI %s', (ai) => {
    expect(parseGs1(`${PRODUCT}${ai}XYZ${GS}10LOT1`)).toMatchObject({
      ok: true,
      lotCode: 'LOT1',
      unparsed: { [ai]: 'XYZ' },
      warnings: ['UNKNOWN_APPLICATION_IDENTIFIER'],
    });
  });

  it('retains distinct reimbursement numbers and deduplicates warnings', () => {
    expect(
      parseGs1(`${PRODUCT}10LOT1${GS}710AAA${GS}711BBB${GS}91A${GS}91B${GS}92C`),
    ).toMatchObject({
      ok: true,
      lotCode: 'LOT1',
      unparsed: { '710': 'AAA', '711': 'BBB', '91': 'A', '92': 'C' },
      warnings: ['UNKNOWN_APPLICATION_IDENTIFIER'],
    });
  });

  it('keeps unknown identifiers sharing their first two digits apart', () => {
    expect(parseGs1(`${PRODUCT}240ABC${GS}241XYZ${GS}`)).toMatchObject({
      ok: true,
      unparsed: { '240': 'ABC', '241': 'XYZ' },
    });
  });

  it.each([
    ['270200', '2027-02-28'],
    ['280200', '2028-02-29'],
    ['270400', '2027-04-30'],
  ])('resolves day zero in %s to %s', (date, expiry) => {
    expect(parseGs1(`${PRODUCT}17${date}`, { currentYear: 2026 })).toMatchObject({
      ok: true,
      expiry,
      warnings: ['EXPIRY_DAY_ASSUMED_END_OF_MONTH'],
    });
  });

  it('accepts a real leap day and keeps the wire date independent of timezone', () => {
    expect(parseGs1(`${PRODUCT}17280229`, { currentYear: 2026 })).toMatchObject({
      ok: true,
      expiry: '2028-02-29',
      warnings: [],
    });
  });

  it.each([
    [2026, '76', 2076],
    [2026, '77', 1977],
    [2026, '86', 1986],
    [2026, '30', 2030],
    [2075, '25', 2125],
    [2075, '26', 2026],
    [2000, '50', 2050],
    [2000, '51', 1951],
    [2099, '00', 2100],
  ])('resolves year %s / %s to %s', (currentYear, yy, year) => {
    expect(parseGs1(`${PRODUCT}17${yy}0131`, { currentYear })).toMatchObject({
      ok: true,
      expiry: `${year}-01-31`,
    });
  });

  it('uses the current year when no year is supplied', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2075, 0, 1));
      expect(parseGs1(`${PRODUCT}17250131`)).toMatchObject({ ok: true, expiry: '2125-01-31' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('cannot detect a serial or expiry swallowed by a variable lot without GS', () => {
    const serial = parseGs1(`${PRODUCT}10ABC12321SER456`);
    const expiry = parseGs1(`${PRODUCT}10LOT117270131`);
    expect(serial).toMatchObject({ ok: true, lotCode: 'ABC12321SER456', warnings: [] });
    expect(expiry).toMatchObject({ ok: true, lotCode: 'LOT117270131', warnings: [] });
    if (serial.ok) expect(serial.serial).toBeUndefined();
    if (expiry.ok) expect(expiry.expiry).toBeUndefined();
  });

  it('requires a recognized prefix only when configured', () => {
    expect(parseGs1(PRODUCT, { requireSymbologyIdentifier: true })).toEqual({
      ok: false,
      error: 'MISSING_SYMBOLOGY_IDENTIFIER',
    });
    expect(parseGs1(`]d2${PRODUCT}`, { requireSymbologyIdentifier: true })).toMatchObject({
      ok: true,
      gtin: GTIN,
    });
  });

  it.each(['~', '^]'])('accepts the configured GS substitute %s', (substitute) => {
    expect(
      parseGs1(`${PRODUCT}10ABC123${substitute}21SER456`, {
        groupSeparatorSubstitutes: [substitute],
      }),
    ).toMatchObject({ ok: true, lotCode: 'ABC123', serial: 'SER456' });
  });

  it('allows disabling check-digit validation without allowing non-digits', () => {
    expect(parseGs1('0105890123456787', { validateGtinCheckDigit: false })).toMatchObject({
      ok: true,
      gtin: '05890123456787',
    });
    expect(parseGs1('010589012345678A', { validateGtinCheckDigit: false })).toEqual({
      ok: false,
      error: 'INVALID_GTIN',
    });
  });
});
