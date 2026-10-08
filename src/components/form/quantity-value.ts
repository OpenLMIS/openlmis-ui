export type QuantityValue = { doses: string; packs: string; remainder: string };

type QuantityPart = keyof QuantityValue;

const packSize = (netContent: number | null | undefined) =>
  netContent && Number.isFinite(netContent) && netContent > 0 ? netContent : 1;

function wholeNumber(text: string): number | null {
  const latin = text.trim().replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
  const value = Number(latin);
  return /^[0-9]+$/.test(latin) && Number.isSafeInteger(value) ? value : null;
}

export function quantityValue(doses = '', netContent?: number | null): QuantityValue {
  if (!doses.trim()) return { doses, packs: '', remainder: '' };
  const value = wholeNumber(doses);
  if (value === null) return { doses, packs: doses, remainder: '' };
  const size = packSize(netContent);
  return { doses, packs: String(Math.floor(value / size)), remainder: String(value % size) };
}

export function updateQuantityValue(
  value: QuantityValue,
  part: QuantityPart,
  text: string,
  netContent?: number | null,
): QuantityValue {
  if (part === 'doses') return quantityValue(text, netContent);
  const next = { ...value, [part]: text };
  if (!next.packs.trim() && !next.remainder.trim()) return { ...next, doses: '' };
  const packs = next.packs.trim() ? wholeNumber(next.packs) : 0;
  const remainder = next.remainder.trim() ? wholeNumber(next.remainder) : 0;
  const size = packSize(netContent);
  const total = packs === null || remainder === null ? null : packs * size + remainder;
  return {
    ...next,
    doses:
      total !== null && Number.isSafeInteger(total)
        ? String(total)
        : `${next.packs || '0'} * ${size} + ${next.remainder || '0'}`,
  };
}
