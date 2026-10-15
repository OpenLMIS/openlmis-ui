import type { ParseKeys } from 'i18next';
import type { ValidAssignmentsFilter } from '@/features/reference-data/api/api';
import { validAssignmentsOptions } from '@/features/reference-data/api/queries';
import { reasonsOf } from '@/features/reference-data/lib/reasons-of';
import type { Reason, ValidReasonAssignment } from '@/features/reference-data/lib/types';
import { allEventCards, issuableCards, kitCards } from '@/features/stock-events/lib/products';
import type { EventStockCard, StockEvent } from '@/features/stock-events/lib/types';

type EventProducts =
  | {
      from: 'stock-cards';
      cardFilter: (cards: readonly EventStockCard[], today: string) => readonly EventStockCard[];
    }
  | { from: 'approved-products' };

export type EventPrintCopy = Record<
  'title' | 'skip' | 'loading' | 'printedTitle' | 'printed' | 'errorTitle' | 'error' | 'refused',
  ParseKeys
>;

export type CounterpartySide = 'destination' | 'source';

export const COUNTERPARTY = {
  destination: {
    resource: 'validDestinations',
    column: 'stock-events.issue-to',
    comments: 'stock-events.destination-comments',
    noLookupTitle: 'stock-events.no-destinations-title',
    noLookupDescription: 'stock-events.no-destinations-description',
    lookupErrorTitle: 'stock-events.destinations-error-title',
    lookupErrorDescription: 'stock-events.destinations-error-description',
  },
  source: {
    resource: 'validSources',
    column: 'stock-events.received-from',
    comments: 'stock-events.source-comments',
    noLookupTitle: 'stock-events.no-sources-title',
    noLookupDescription: 'stock-events.no-sources-description',
    lookupErrorTitle: 'stock-events.sources-error-title',
    lookupErrorDescription: 'stock-events.sources-error-description',
  },
} as const satisfies Record<
  CounterpartySide,
  { resource: 'validSources' | 'validDestinations' } & Record<
    | 'column'
    | 'comments'
    | 'noLookupTitle'
    | 'noLookupDescription'
    | 'lookupErrorTitle'
    | 'lookupErrorDescription',
    ParseKeys
  >
>;

export function counterpartyOptions(side: CounterpartySide, filter: ValidAssignmentsFilter) {
  return validAssignmentsOptions(COUNTERPARTY[side].resource, filter);
}

export type EventKindConfig = {
  listRoute:
    | '/stock-management/adjustments'
    | '/stock-management/issue'
    | '/stock-management/receive'
    | '/stock-management/unpack';
  editorRoute:
    | '/stock-management/adjustments/$programId'
    | '/stock-management/issue/$programId'
    | '/stock-management/receive/$programId'
    | '/stock-management/unpack/$programId';
  historyType: 'adjustment' | 'issue' | 'receive';
  eventOrigin: NonNullable<StockEvent['eventOrigin']> | null;
  contents:
    | { type: 'none' }
    | {
        type: 'kit';
        copy: Record<
          | 'notSetUpTitle'
          | 'notSetUpDescription'
          | 'contentsChangedTitle'
          | 'contentsChangedDescription'
          | 'refreshOffline'
          | 'notAKit'
          | 'contentsInvalid'
          | 'contentsTooLarge',
          ParseKeys
        >;
      };
  confirmation:
    | { type: 'signature' }
    | { type: 'confirm'; title: ParseKeys; description: ParseKeys };
  scanning: boolean;
  download: 'adjustment' | null;
  drafts: 'device' | null;
  width: 'default' | 'wide';
  columnFit: 'thresholds' | 'measured';
  twoLineSelectMinWidth: number | null;
  measuredFitKeep: readonly ('productCode' | 'packSize' | 'total' | 'expiry')[];
  products: EventProducts;
  print: EventPrintCopy | null;
  counterparty: 'none' | CounterpartySide;
  reasonRequired: boolean;
  reasons: ((assignments: readonly ValidReasonAssignment[]) => Reason[]) | null;
  stockOnHandCap: 'debit-reason' | 'always' | 'never';
  newLots: 'none' | 'manual-and-scan';
  copy: Record<
    | 'pickerTitle'
    | 'make'
    | 'pageDescription'
    | 'product'
    | 'productPlaceholder'
    | 'noProducts'
    | 'clearTitle'
    | 'clearDescription'
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
    ParseKeys
  >;
  columnChoicesKey: string;
  formId: string;
};

export const EVENT_KINDS = {
  adjustment: {
    listRoute: '/stock-management/adjustments',
    editorRoute: '/stock-management/adjustments/$programId',
    historyType: 'adjustment',
    download: 'adjustment',
    drafts: 'device',
    eventOrigin: 'ADJUSTMENT',
    contents: { type: 'none' },
    confirmation: { type: 'signature' },
    scanning: true,
    width: 'default',
    columnFit: 'thresholds',
    twoLineSelectMinWidth: null,
    measuredFitKeep: [],
    products: { from: 'stock-cards', cardFilter: allEventCards },
    print: null,
    counterparty: 'none',
    reasonRequired: true,
    reasons: (assignments: readonly ValidReasonAssignment[]) =>
      reasonsOf(assignments, 'ADJUSTMENT'),
    stockOnHandCap: 'debit-reason',
    newLots: 'none',
    copy: {
      pickerTitle: 'stock-adjustment.title',
      make: 'stock-adjustment.make',
      pageDescription: 'stock-adjustment.page-description',
      product: 'stock-events.product',
      productPlaceholder: 'stock-events.select-product',
      noProducts: 'stock-adjustment.no-products',
      clearTitle: 'stock-events.clear-title',
      clearDescription: 'stock-events.clear-description',
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
    listRoute: '/stock-management/issue',
    editorRoute: '/stock-management/issue/$programId',
    historyType: 'issue',
    download: null,
    drafts: null,
    eventOrigin: 'ISSUE',
    contents: { type: 'none' },
    confirmation: { type: 'signature' },
    scanning: true,
    width: 'wide',
    columnFit: 'measured',
    twoLineSelectMinWidth: 1100,
    measuredFitKeep: [],
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
    newLots: 'none',
    copy: {
      pickerTitle: 'stock-issue.title',
      make: 'stock-issue.make',
      pageDescription: 'stock-issue.page-description',
      product: 'stock-events.product',
      productPlaceholder: 'stock-events.select-product',
      noProducts: 'stock-issue.no-products',
      clearTitle: 'stock-events.clear-title',
      clearDescription: 'stock-events.clear-description',
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
  receive: {
    listRoute: '/stock-management/receive',
    editorRoute: '/stock-management/receive/$programId',
    historyType: 'receive',
    download: null,
    drafts: null,
    eventOrigin: 'RECEIVE',
    contents: { type: 'none' },
    confirmation: { type: 'signature' },
    scanning: true,
    width: 'wide',
    columnFit: 'measured',
    twoLineSelectMinWidth: 1100,
    measuredFitKeep: [],
    products: { from: 'approved-products' },
    print: {
      title: 'stock-receive.print-title',
      skip: 'stock-receive.print-skip',
      loading: 'stock-receive.print-loading',
      printedTitle: 'stock-receive.printed-title',
      printed: 'stock-receive.printed',
      errorTitle: 'stock-receive.print-error-title',
      error: 'stock-receive.print-error',
      refused: 'stock-receive.print-refused',
    },
    counterparty: 'source',
    reasonRequired: false,
    reasons: (assignments: readonly ValidReasonAssignment[]) =>
      reasonsOf(assignments, 'TRANSFER', 'CREDIT'),
    stockOnHandCap: 'never',
    newLots: 'manual-and-scan',
    copy: {
      pickerTitle: 'stock-receive.title',
      make: 'stock-receive.make',
      pageDescription: 'stock-receive.page-description',
      noProducts: 'stock-receive.no-products',
      product: 'stock-events.product',
      productPlaceholder: 'stock-events.select-product',
      clearTitle: 'stock-events.clear-title',
      clearDescription: 'stock-events.clear-description',
      editorTitle: 'stock-receive.editor-title',
      editorDescription: 'stock-receive.editor-description',
      emptyTitle: 'stock-receive.empty-title',
      emptyDescription: 'stock-receive.empty-description',
      invalidTitle: 'stock-receive.invalid-title',
      invalidDescription: 'stock-receive.invalid-description',
      submitErrorTitle: 'stock-receive.submit-error-title',
      submitErrorDescription: 'stock-receive.submit-error-description',
      submittedTitle: 'stock-receive.submitted-title',
      submittedDescription: 'stock-receive.submitted-description',
    },
    columnChoicesKey: 'receive-columns',
    formId: 'receive-form',
  },
  unpack: {
    listRoute: '/stock-management/unpack',
    editorRoute: '/stock-management/unpack/$programId',
    historyType: 'adjustment',
    download: null,
    drafts: null,
    eventOrigin: null,
    contents: {
      type: 'kit',
      copy: {
        notSetUpTitle: 'stock-unpack.not-set-up-title',
        notSetUpDescription: 'stock-unpack.not-set-up-description',
        contentsChangedTitle: 'stock-unpack.contents-changed-title',
        contentsChangedDescription: 'stock-unpack.contents-changed-description',
        refreshOffline: 'stock-unpack.refresh-offline',
        notAKit: 'stock-unpack.not-a-kit',
        contentsInvalid: 'stock-unpack.contents-invalid',
        contentsTooLarge: 'stock-unpack.contents-too-large',
      },
    },
    confirmation: {
      type: 'confirm',
      title: 'stock-unpack.confirm-title',
      description: 'stock-unpack.confirm-description',
    },
    scanning: false,
    columnFit: 'measured',
    twoLineSelectMinWidth: null,
    measuredFitKeep: ['productCode'],
    width: 'default',
    products: { from: 'stock-cards', cardFilter: kitCards },
    print: null,
    newLots: 'none',
    counterparty: 'none',
    reasonRequired: false,
    reasons: null,
    stockOnHandCap: 'always',
    copy: {
      pickerTitle: 'stock-unpack.title',
      make: 'stock-unpack.make',
      pageDescription: 'stock-unpack.page-description',
      editorTitle: 'stock-unpack.editor-title',
      editorDescription: 'stock-unpack.editor-description',
      product: 'stock-unpack.kit',
      productPlaceholder: 'stock-unpack.select-kit',
      noProducts: 'stock-unpack.no-kits',
      clearTitle: 'stock-unpack.clear-title',
      clearDescription: 'stock-unpack.clear-description',
      emptyTitle: 'stock-unpack.empty-title',
      emptyDescription: 'stock-unpack.empty-description',
      invalidTitle: 'stock-unpack.invalid-title',
      invalidDescription: 'stock-unpack.invalid-description',
      submitErrorTitle: 'stock-unpack.submit-error-title',
      submitErrorDescription: 'stock-unpack.submit-error-description',
      submittedTitle: 'stock-unpack.submitted-title',
      submittedDescription: 'stock-unpack.submitted-description',
    },
    columnChoicesKey: 'unpack-columns',
    formId: 'unpack-form',
  },
} as const satisfies Record<'adjustment' | 'issue' | 'receive' | 'unpack', EventKindConfig>;

export type ConfiguredEventKind = keyof typeof EVENT_KINDS;
