import { describe, expect, it } from 'vitest';
import { scanMessage } from '@/lib/scan-messages';

describe('scanMessage', () => {
  it.each([
    ['EMPTY_INPUT', 'not-recognized'],
    ['MALFORMED_ELEMENT_STRING', 'not-recognized'],
    ['NO_APPLICATION_IDENTIFIERS', 'not-recognized'],
    ['DUPLICATE_APPLICATION_IDENTIFIER', 'not-recognized'],
    ['VALUE_TOO_LONG', 'scanner-setup'],
    ['INVALID_LOT_CODE', 'scanner-setup'],
    ['INVALID_SERIAL', 'scanner-setup'],
    ['MISSING_SYMBOLOGY_IDENTIFIER', 'scanner-setup'],
    ['MISSING_GTIN', 'no-product-code'],
    ['INVALID_GTIN', 'product-code'],
    ['INVALID_GTIN_CHECK_DIGIT', 'product-code'],
    ['INVALID_EXPIRATION_DATE', 'expiry'],
    ['TRUNCATED_ELEMENT_STRING', 'incomplete'],
  ] as const)('maps %s to the legacy parser message', (error, suffix) => {
    expect(scanMessage(error)).toEqual({ key: `scan.error.${suffix}` });
  });
  it.each([
    ['productNotOnScreen', 'product-not-on-screen'],
    ['productAmbiguous', 'product-ambiguous'],
    ['lotNotOnScreen', 'lot-not-on-screen'],
    ['lotRequired', 'lot-required'],
    ['noGtin', 'error.no-product-code'],
    ['gtinLookupFailed', 'gtin-lookup-failed'],
    ['gtinNotRegistered', 'gtin-not-registered'],
  ] as const)('maps %s and preserves interpolation values', (reason, suffix) => {
    expect(scanMessage(reason, { gtin: '00123', lotCode: 'LOT' })).toEqual({
      key: `scan.${suffix}`,
      params: { gtin: '00123', lotCode: 'LOT' },
    });
  });
});
