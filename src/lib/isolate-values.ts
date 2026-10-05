import {
  isArgumentElement,
  isDateElement,
  isNumberElement,
  isPluralElement,
  isSelectElement,
  isTimeElement,
  type MessageFormatElement,
  parse,
} from '@formatjs/icu-messageformat-parser';
import ICU from 'i18next-icu';
import { getTextDirection } from '@/lib/config';

const FIRST_STRONG_ISOLATE = '⁨';
const POP_DIRECTIONAL_ISOLATE = '⁩';

const namesByMessage = new Map<string, string[]>();

function collect(elements: MessageFormatElement[], plain: Set<string>, formatted: Set<string>) {
  for (const element of elements) {
    if (isArgumentElement(element)) plain.add(element.value);
    else if (isSelectElement(element) || isPluralElement(element)) {
      formatted.add(element.value);
      for (const option of Object.values(element.options)) collect(option.value, plain, formatted);
    } else if (isNumberElement(element) || isDateElement(element) || isTimeElement(element)) {
      formatted.add(element.value);
    }
  }
}

function namesIn(message: string) {
  const plain = new Set<string>();
  const formatted = new Set<string>();
  try {
    collect(parse(message, { ignoreTag: true }), plain, formatted);
  } catch {
    return [];
  }
  return [...plain].filter((name) => !formatted.has(name));
}

function plainNames(message: string) {
  let names = namesByMessage.get(message);
  if (!names) {
    names = namesIn(message);
    namesByMessage.set(message, names);
  }
  return names;
}

export function isolateValues<T extends Record<string, unknown>>(message: string, values: T): T {
  const names = plainNames(message).filter((name) => {
    const value = values[name];
    return typeof value === 'string' && value !== '';
  });
  if (names.length === 0) return values;
  const isolated = names.map((name) => [
    name,
    `${FIRST_STRONG_ISOLATE}${values[name]}${POP_DIRECTIONAL_ISOLATE}`,
  ]);
  return { ...values, ...Object.fromEntries(isolated) };
}

type Parse = (
  res: unknown,
  options: Record<string, unknown> | undefined,
  lng: string,
  ...rest: unknown[]
) => unknown;

const parseWithICU = (ICU.prototype as unknown as { parse: Parse }).parse;

export class IsolatingICU extends ICU {
  parse(
    res: unknown,
    options: Record<string, unknown> | undefined,
    lng: string,
    ...rest: unknown[]
  ) {
    const values =
      typeof res === 'string' && options && getTextDirection(lng) === 'rtl'
        ? isolateValues(res, options)
        : options;
    return parseWithICU.call(this, res, values, lng, ...rest);
  }
}
