import type { ReportTemplateParameter } from '@/features/reports/lib/types';

export type ReportChoice = { value: string; label: string };

export type ReportLookup = {
  method: 'GET' | 'POST';
  /** Relative to the API base, e.g. `/facilities`. */
  path: string;
  body?: Record<string, string>;
  valueProperty: string;
  labelProperty: string | null;
};

/** Where the shared client sends requests: its base URL, resolved against the page's origin. */
export type ApiBase = { baseURL: string; origin: string };

export class IncompleteLookupError extends Error {
  constructor() {
    super('The server returned only part of the choices.');
    this.name = 'IncompleteLookupError';
  }
}

const API_PATH = /^\/api(?:\/[A-Za-z0-9_~-][A-Za-z0-9._~-]*)+$/;

/** The API-relative path of a template's lookup, or null when it could leave the configured API. */
export function lookupPath(expression: string, { baseURL, origin }: ApiBase): string | null {
  if (!API_PATH.test(expression)) return null;
  const path = expression.slice('/api'.length);
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  try {
    const base = new URL(`${baseURL.replace(/\/+$/, '')}/`, origin);
    const target = new URL(`${base.pathname}${path.slice(1)}`, base);
    if (target.origin !== base.origin) return null;
    if (target.pathname !== `${base.pathname}${path.slice(1)}`) return null;
    if (target.search || target.hash) return null;
  } catch {
    return null;
  }
  return path;
}

/** Legacy sends level 2 whenever the template stores a body, whatever it says, and `{}` otherwise. */
function legacyZoneSearchBody(
  selectBody: string | null | undefined,
): Record<string, string> | null {
  if (!selectBody) return {};
  try {
    const stored: unknown = JSON.parse(selectBody);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return null;
  } catch {
    return null;
  }
  return { levelNumber: '2' };
}

/** The read a template parameter asks for, or null when the client must not make it. */
export function toLookup(parameter: ReportTemplateParameter, api: ApiBase): ReportLookup | null {
  const method = parameter.selectMethod || 'GET';
  if (method !== 'GET' && method !== 'POST') return null;
  if (!parameter.selectExpression || !parameter.selectProperty) return null;
  const path = lookupPath(parameter.selectExpression, api);
  if (!path) return null;
  const lookup: ReportLookup = {
    method,
    path,
    valueProperty: parameter.selectProperty,
    labelProperty: parameter.displayProperty || null,
  };
  if (method === 'GET') return lookup;
  const body = legacyZoneSearchBody(parameter.selectBody);
  return body ? { ...lookup, body } : null;
}

/** The records of a lookup response: a list, or a page that holds every record. */
export function lookupItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'content' in data && Array.isArray(data.content)) {
    const page = data as { content: unknown[]; totalElements?: unknown; totalPages?: unknown };
    if (
      page.totalElements !== page.content.length ||
      (typeof page.totalPages === 'number' && page.totalPages > 1)
    )
      throw new IncompleteLookupError();
    return page.content;
  }
  throw new Error('The server returned choices in an unknown shape.');
}

const choiceText = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '';

/** Value and label of each record, in the order returned, without empty or repeated values. */
export function projectOptions(
  items: readonly unknown[],
  valueProperty: string,
  labelProperty: string | null,
): ReportChoice[] {
  const seen = new Set<string>();
  const choices: ReportChoice[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const value = choiceText(record[valueProperty]);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    const label = labelProperty ? choiceText(record[labelProperty]) : '';
    choices.push({ value, label: label || value });
  }
  return choices;
}

/** Static options as legacy shows them: each option is both value and label. */
export function staticChoices(options: readonly unknown[]): ReportChoice[] {
  return projectOptions(
    options.map((option) => ({ option })),
    'option',
    null,
  );
}
