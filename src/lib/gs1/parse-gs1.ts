export type Gs1Error =
  | 'EMPTY_INPUT'
  | 'MISSING_SYMBOLOGY_IDENTIFIER'
  | 'MALFORMED_ELEMENT_STRING'
  | 'TRUNCATED_ELEMENT_STRING'
  | 'NO_APPLICATION_IDENTIFIERS'
  | 'DUPLICATE_APPLICATION_IDENTIFIER'
  | 'VALUE_TOO_LONG'
  | 'MISSING_GTIN'
  | 'INVALID_GTIN'
  | 'INVALID_GTIN_CHECK_DIGIT'
  | 'INVALID_EXPIRATION_DATE'
  | 'INVALID_LOT_CODE'
  | 'INVALID_SERIAL';

export type Gs1Warning = 'EXPIRY_DAY_ASSUMED_END_OF_MONTH' | 'UNKNOWN_APPLICATION_IDENTIFIER';

export type Gs1Symbology = 'GS1_DATA_MATRIX' | 'GS1_128' | 'GS1_DATABAR' | 'GS1_QR_CODE';

export type Gs1ParseOptions = {
  currentYear?: number;
  requireSymbologyIdentifier?: boolean;
  groupSeparatorSubstitutes?: readonly string[];
  validateGtinCheckDigit?: boolean;
};

export type Gs1Success = {
  ok: true;
  gtin: string;
  lotCode?: string;
  expiry?: string;
  serial?: string;
  symbology?: Gs1Symbology;
  warnings: Gs1Warning[];
  unparsed: Record<string, string>;
};

export type Gs1Result = Gs1Success | { ok: false; error: Gs1Error };

const GS = '\u001D';
const CHARACTER_SET_82 = /^[!"%&'()*+,\-./0-9:;<=>?A-Z_a-z]*$/;
const SYMBOLOGIES: Record<string, Gs1Symbology> = {
  ']d2': 'GS1_DATA_MATRIX',
  ']C1': 'GS1_128',
  ']e0': 'GS1_DATABAR',
  ']Q3': 'GS1_QR_CODE',
};

type ParsedField = 'gtin' | 'lotCode' | 'expiry' | 'serial';
type ElementDefinition = { aiLength: number; length?: number; field?: ParsedField };

const EXTRACTED: Record<string, ElementDefinition> = {
  '01': { aiLength: 2, length: 14, field: 'gtin' },
  '10': { aiLength: 2, field: 'lotCode' },
  '17': { aiLength: 2, length: 6, field: 'expiry' },
  '21': { aiLength: 2, field: 'serial' },
};

function definitionFor(prefix: string): ElementDefinition {
  if (EXTRACTED[prefix]) return EXTRACTED[prefix];
  if (prefix === '00') return { aiLength: 2, length: 18 };
  if (['02', '03'].includes(prefix)) return { aiLength: 2, length: 14 };
  if (prefix === '04') return { aiLength: 2, length: 16 };
  if (/^1[1-9]$/.test(prefix)) return { aiLength: 2, length: 6 };
  if (prefix === '20') return { aiLength: 2, length: 2 };
  if (/^3[1-6]$/.test(prefix)) return { aiLength: 4, length: 6 };
  if (prefix === '41') return { aiLength: 3, length: 13 };
  if (['23', '24', '25', '40', '42', '71'].includes(prefix)) return { aiLength: 3 };
  if (['39', '43', '70', '72', '80', '81', '82'].includes(prefix)) return { aiLength: 4 };
  return { aiLength: 2 };
}

function failure(error: Gs1Error): Gs1Result {
  return { ok: false, error };
}

function validCheckDigit(gtin: string) {
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(gtin[i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(gtin[13]);
}

function parseExpiry(raw: string, currentYear: number) {
  if (!/^\d{6}$/.test(raw)) return undefined;
  let year = Math.floor(currentYear / 100) * 100 + Number(raw.slice(0, 2));
  if (year - currentYear > 50) year -= 100;
  else if (year - currentYear < -49) year += 100;

  const month = Number(raw.slice(2, 4));
  const day = Number(raw.slice(4));
  if (month < 1 || month > 12) return undefined;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lastDay = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day > lastDay) return undefined;
  return {
    expiry: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day || lastDay).padStart(2, '0')}`,
    assumedDay: day === 0,
  };
}

export function parseGs1(raw: string, options: Gs1ParseOptions = {}): Gs1Result {
  if (!raw) return failure('EMPTY_INPUT');
  const symbology = SYMBOLOGIES[raw.slice(0, 3)];
  if (!symbology && options.requireSymbologyIdentifier) {
    return failure('MISSING_SYMBOLOGY_IDENTIFIER');
  }
  let payload = symbology ? raw.slice(3) : raw;
  for (const substitute of options.groupSeparatorSubstitutes ?? []) {
    payload = payload.split(substitute).join(GS);
  }

  const values: Partial<Record<ParsedField, string>> = {};
  const unparsed: Record<string, string> = {};
  const warnings: Gs1Warning[] = [];
  let cursor = 0;
  while (cursor < payload.length) {
    if (payload[cursor] === GS) {
      cursor++;
      continue;
    }
    const prefix = payload.slice(cursor, cursor + 2);
    if (!/^\d{2}$/.test(prefix)) return failure('MALFORMED_ELEMENT_STRING');
    const definition = definitionFor(prefix);
    const start = cursor + definition.aiLength;
    const separator = payload.indexOf(GS, start);
    const end = definition.length
      ? start + definition.length
      : separator === -1
        ? payload.length
        : separator;
    const ai = payload.slice(cursor, start);
    const value = payload.slice(start, end);
    if (!value.length || (definition.length && value.length < definition.length)) {
      return failure('TRUNCATED_ELEMENT_STRING');
    }
    if (!definition.length && definition.field && value.length > 20) {
      return failure('VALUE_TOO_LONG');
    }
    if (ai.includes(GS) || value.includes(GS)) return failure('MALFORMED_ELEMENT_STRING');
    if (definition.field) {
      if (values[definition.field] !== undefined)
        return failure('DUPLICATE_APPLICATION_IDENTIFIER');
      values[definition.field] = value;
    } else {
      if (unparsed[ai] === undefined) unparsed[ai] = value;
      if (!warnings.includes('UNKNOWN_APPLICATION_IDENTIFIER')) {
        warnings.push('UNKNOWN_APPLICATION_IDENTIFIER');
      }
    }
    cursor = end;
  }

  if (!Object.keys(values).length && !Object.keys(unparsed).length) {
    return failure('NO_APPLICATION_IDENTIFIERS');
  }
  if (values.gtin === undefined) return failure('MISSING_GTIN');
  if (!/^\d{14}$/.test(values.gtin)) return failure('INVALID_GTIN');
  if (options.validateGtinCheckDigit !== false && !validCheckDigit(values.gtin)) {
    return failure('INVALID_GTIN_CHECK_DIGIT');
  }
  if (values.lotCode !== undefined && !CHARACTER_SET_82.test(values.lotCode)) {
    return failure('INVALID_LOT_CODE');
  }
  const expiry =
    values.expiry === undefined
      ? undefined
      : parseExpiry(values.expiry, options.currentYear ?? new Date().getFullYear());
  if (values.expiry !== undefined && !expiry) return failure('INVALID_EXPIRATION_DATE');
  if (values.serial !== undefined && !CHARACTER_SET_82.test(values.serial)) {
    return failure('INVALID_SERIAL');
  }
  if (expiry?.assumedDay) warnings.push('EXPIRY_DAY_ASSUMED_END_OF_MONTH');

  return {
    ok: true,
    gtin: values.gtin,
    lotCode: values.lotCode,
    expiry: expiry?.expiry,
    serial: values.serial,
    symbology,
    warnings,
    unparsed,
  };
}
