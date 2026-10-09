import { reasonsOf } from '@/features/reference-data/lib/reasons-of';
import type { Reason, ValidReasonAssignment } from '@/features/reference-data/lib/types';
import { allEventCards, issuableCards } from '@/features/stock-events/lib/products';
import type { EventStockCard, StockEvent } from '@/features/stock-events/lib/types';

export type EventKindConfig = {
  eventOrigin: StockEvent['eventOrigin'];
  cardFilter: (cards: readonly EventStockCard[], today: string) => readonly EventStockCard[];
  counterparty: 'none' | 'destination';
  reasonRequired: boolean;
  reasons: (assignments: readonly ValidReasonAssignment[]) => Reason[];
  stockOnHandCap: 'debit-reason' | 'always';
  copy: Record<
    | 'emptyTitle'
    | 'emptyDescription'
    | 'invalidTitle'
    | 'invalidDescription'
    | 'submitErrorTitle'
    | 'submitErrorDescription'
    | 'submittedTitle'
    | 'submittedDescription',
    string
  >;
  columnChoicesKey: string;
  formId: string;
};

export const EVENT_KINDS = {
  adjustment: {
    eventOrigin: 'ADJUSTMENT',
    cardFilter: allEventCards,
    counterparty: 'none',
    reasonRequired: true,
    reasons: (assignments: readonly ValidReasonAssignment[]) =>
      reasonsOf(assignments, 'ADJUSTMENT'),
    stockOnHandCap: 'debit-reason',
    copy: {
      emptyTitle: 'stock-adjustment.empty-title',
      emptyDescription: 'stock-adjustment.empty-description',
      invalidTitle: 'stock-adjustment.invalid-title',
      invalidDescription: 'stock-adjustment.invalid-description',
      submitErrorTitle: 'stock-adjustment.submit-error-title',
      submitErrorDescription: 'stock-adjustment.submit-error-description',
      submittedTitle: 'stock-adjustment.submitted-title',
      submittedDescription: 'stock-adjustment.submitted-description',
    },
    columnChoicesKey: 'adjustment-columns',
    formId: 'adjustment-form',
  },
  issue: {
    eventOrigin: 'ISSUE',
    cardFilter: issuableCards,
    counterparty: 'destination',
    reasonRequired: false,
    reasons: (assignments: readonly ValidReasonAssignment[]) =>
      reasonsOf(assignments, 'TRANSFER', 'DEBIT'),
    stockOnHandCap: 'always',
    copy: {
      emptyTitle: 'stock-issue.empty-title',
      emptyDescription: 'stock-issue.empty-description',
      invalidTitle: 'stock-issue.invalid-title',
      invalidDescription: 'stock-issue.invalid-description',
      submitErrorTitle: 'stock-issue.submit-error-title',
      submitErrorDescription: 'stock-issue.submit-error-description',
      submittedTitle: 'stock-issue.submitted-title',
      submittedDescription: 'stock-issue.submitted-description',
    },
    columnChoicesKey: 'issue-columns',
    formId: 'issue-form',
  },
} as const satisfies Record<'adjustment' | 'issue', EventKindConfig>;

export type ConfiguredEventKind = keyof typeof EVENT_KINDS;
