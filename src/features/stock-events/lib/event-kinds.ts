import type { ParseKeys } from 'i18next';
import { reasonsOf } from '@/features/reference-data/lib/reasons-of';
import type { Reason, ValidReasonAssignment } from '@/features/reference-data/lib/types';
import { allEventCards, issuableCards } from '@/features/stock-events/lib/products';
import type { EventStockCard, StockEvent } from '@/features/stock-events/lib/types';

export type EventProducts = {
  from: 'stock-cards';
  cardFilter: (cards: readonly EventStockCard[], today: string) => readonly EventStockCard[];
};

export type EventPrintCopy = Record<
  'title' | 'skip' | 'loading' | 'printedTitle' | 'printed' | 'errorTitle' | 'error' | 'refused',
  ParseKeys
>;

export type EventKindConfig = {
  eventOrigin: StockEvent['eventOrigin'];
  width: 'default' | 'wide';
  columnFit: 'thresholds' | 'measured';
  products: EventProducts;
  print: EventPrintCopy | null;
  counterparty: 'none' | 'destination';
  reasonRequired: boolean;
  reasons: (assignments: readonly ValidReasonAssignment[]) => Reason[];
  stockOnHandCap: 'debit-reason' | 'always';
  copy: Record<
    | 'editorTitle'
    | 'editorDescription'
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
    width: 'default',
    columnFit: 'thresholds',
    products: { from: 'stock-cards', cardFilter: allEventCards },
    print: null,
    counterparty: 'none',
    reasonRequired: true,
    reasons: (assignments: readonly ValidReasonAssignment[]) =>
      reasonsOf(assignments, 'ADJUSTMENT'),
    stockOnHandCap: 'debit-reason',
    copy: {
      editorTitle: 'stock-adjustment.editor-title',
      editorDescription: 'stock-adjustment.editor-description',
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
    width: 'wide',
    columnFit: 'measured',
    products: { from: 'stock-cards', cardFilter: issuableCards },
    print: {
      title: 'stock-issue.print-title',
      skip: 'stock-issue.print-skip',
      loading: 'stock-issue.print-loading',
      printedTitle: 'stock-issue.printed-title',
      printed: 'stock-issue.printed',
      errorTitle: 'stock-issue.print-error-title',
      error: 'stock-issue.print-error',
      refused: 'stock-issue.print-refused',
    },
    counterparty: 'destination',
    reasonRequired: false,
    reasons: (assignments: readonly ValidReasonAssignment[]) =>
      reasonsOf(assignments, 'TRANSFER', 'DEBIT'),
    stockOnHandCap: 'always',
    copy: {
      editorTitle: 'stock-issue.editor-title',
      editorDescription: 'stock-issue.editor-description',
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

export type PrintableEventKind = {
  [Kind in ConfiguredEventKind]: (typeof EVENT_KINDS)[Kind]['print'] extends null ? never : Kind;
}[ConfiguredEventKind];
