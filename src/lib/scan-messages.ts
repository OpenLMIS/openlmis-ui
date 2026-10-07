import type { ParseKeys } from 'i18next';
import type { Gs1Error } from '@/lib/gs1/parse-gs1';

export type ScanMessage = { key: ParseKeys; params?: Record<string, string | number> };
export type ScanRefusal =
  | 'productNotOnScreen'
  | 'productAmbiguous'
  | 'lotNotOnScreen'
  | 'lotRequired';
export type ScanLookupFailure = 'noGtin' | 'gtinLookupFailed' | 'gtinNotRegistered';

const MESSAGE_KEYS = {
  EMPTY_INPUT: 'scan.error.not-recognized',
  MISSING_SYMBOLOGY_IDENTIFIER: 'scan.error.scanner-setup',
  MALFORMED_ELEMENT_STRING: 'scan.error.not-recognized',
  TRUNCATED_ELEMENT_STRING: 'scan.error.incomplete',
  NO_APPLICATION_IDENTIFIERS: 'scan.error.not-recognized',
  DUPLICATE_APPLICATION_IDENTIFIER: 'scan.error.not-recognized',
  VALUE_TOO_LONG: 'scan.error.scanner-setup',
  MISSING_GTIN: 'scan.error.no-product-code',
  INVALID_GTIN: 'scan.error.product-code',
  INVALID_GTIN_CHECK_DIGIT: 'scan.error.product-code',
  INVALID_EXPIRATION_DATE: 'scan.error.expiry',
  INVALID_LOT_CODE: 'scan.error.scanner-setup',
  INVALID_SERIAL: 'scan.error.scanner-setup',
  productNotOnScreen: 'scan.product-not-on-screen',
  productAmbiguous: 'scan.product-ambiguous',
  lotNotOnScreen: 'scan.lot-not-on-screen',
  lotRequired: 'scan.lot-required',
  noGtin: 'scan.error.no-product-code',
  gtinLookupFailed: 'scan.gtin-lookup-failed',
  gtinNotRegistered: 'scan.gtin-not-registered',
} as const satisfies Record<Gs1Error | ScanRefusal | ScanLookupFailure, ParseKeys>;

export function scanMessage(
  reason: Gs1Error | ScanRefusal | ScanLookupFailure,
  params?: ScanMessage['params'],
): ScanMessage {
  const key = MESSAGE_KEYS[reason];
  return params ? { key, params } : { key };
}
