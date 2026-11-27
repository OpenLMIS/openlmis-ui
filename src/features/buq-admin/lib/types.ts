import type { BuqCatalogRecord } from '@/features/reference-data/lib/types';

export const BUQ_CATALOG_TABS = ['remarks', 'sources'] as const;

export type BuqCatalogTab = (typeof BUQ_CATALOG_TABS)[number];

export const BUQ_CATALOGS = {
  remarks: { kind: 'remark', path: '/remark', label: 'manage-buq.remark' },
  sources: { kind: 'source', path: '/sourcesOfFunds', label: 'manage-buq.source' },
} as const;

export const BUQ_CATALOG_NOT_FOUND = {
  remarks: 'api-error.buq.error.remark.notFound',
  sources: 'api-error.buq.error.sourceOfFund.notFound',
} as const;

export type BuqCatalogWrite = Pick<BuqCatalogRecord, 'name' | 'description'>;

export type BuqCatalogRowAction = (record: BuqCatalogRecord, opener: HTMLButtonElement) => void;
