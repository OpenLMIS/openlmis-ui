export type StockScan = {
  gtin: string;
  lotCode?: string;
  expiry?: string | Date;
  serial?: string;
};

export type ScanOrderable = { id: string; identifiers?: Record<string, string> };
export type ScanLot = {
  id?: string;
  lotCode: string;
  expirationDate?: string | Date | null;
};
export type ScanCard = {
  id?: string;
  orderable: ScanOrderable;
  lot: ScanLot | null;
  stockOnHand: number;
};
export type ScanProduct<Card extends ScanCard = ScanCard> = {
  orderable: Card['orderable'];
  cards: readonly Card[];
};
export type ScanLine = { key: string; orderable: ScanOrderable; lot: ScanLot | null };
export type ScanPolicy = { allowsNewLot: boolean; tracksLots?: boolean };
export type ScanRefusalReason =
  | 'productNotOnScreen'
  | 'productAmbiguous'
  | 'lotRequired'
  | 'lotNotOnScreen';
export type ScanAction<Card extends ScanCard = ScanCard> =
  | { type: 'count'; lineKey: string }
  | { type: 'add'; card: Card };
export type ScanResolution<Card extends ScanCard = ScanCard> =
  | { type: 'refuse'; reason: ScanRefusalReason; params: Record<string, string> }
  | ScanAction<Card>
  | { type: 'confirm-expiry'; recorded: string; scanned: string; next: ScanAction<Card> };
export type PendingScanCard<Card extends ScanCard = ScanCard> = Omit<Card, 'id' | 'lot'> & {
  lot: { lotCode: string; expirationDate: string | null; tradeItemId: string };
};
export type ResolveScanOptions<Card extends ScanCard = ScanCard> = {
  scan: StockScan;
  tradeItemId: string;
  products: readonly ScanProduct<Card>[];
  lines: readonly ScanLine[];
  policy: ScanPolicy;
};

function dateValue(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value.slice(0, 10);
  if (!Number.isFinite(value.getTime())) return undefined;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function sameLot(first: ScanLot | null, second: ScanLot | null): boolean {
  if (!first || !second) return first === second;
  if (first.id || second.id) return !!first.id && first.id === second.id;
  return first.lotCode.toLowerCase() === second.lotCode.toLowerCase();
}

export function resolveScan<Card extends ScanCard>(
  options: ResolveScanOptions<Card> & { policy: ScanPolicy & { allowsNewLot: false } },
): ScanResolution<Card>;
export function resolveScan<Card extends ScanCard>(
  options: ResolveScanOptions<Card>,
): ScanResolution<Card | PendingScanCard<Card>>;
export function resolveScan<Card extends ScanCard>({
  scan,
  tradeItemId,
  products,
  lines,
  policy,
}: ResolveScanOptions<Card>): ScanResolution<Card | PendingScanCard<Card>> {
  const matches = products.filter(
    (product) => product.orderable.identifiers?.tradeItem === tradeItemId,
  );
  if (!matches.length)
    return { type: 'refuse', reason: 'productNotOnScreen', params: { gtin: scan.gtin } };
  if (matches.length > 1)
    return { type: 'refuse', reason: 'productAmbiguous', params: { gtin: scan.gtin } };

  const product = matches[0];
  const lotCode = policy.tracksLots === false ? undefined : scan.lotCode;
  let card: Card | PendingScanCard<Card> | undefined = product.cards.find((candidate) =>
    lotCode ? candidate.lot?.lotCode.toLowerCase() === lotCode.toLowerCase() : !candidate.lot,
  );
  if (!card) {
    if (!lotCode) return { type: 'refuse', reason: 'lotRequired', params: {} };
    const template = product.cards[0];
    if (!policy.allowsNewLot || !template)
      return { type: 'refuse', reason: 'lotNotOnScreen', params: { lotCode } };
    const pending = lines.find(
      (line) =>
        line.orderable.id === product.orderable.id &&
        !line.lot?.id &&
        line.lot?.lotCode.toLowerCase() === lotCode.toLowerCase(),
    );
    const expiry = pending ? pending.lot?.expirationDate : scan.expiry;
    const { id: _id, lot: _lot, ...rest } = template;
    card = {
      ...rest,
      orderable: product.orderable,
      stockOnHand: 0,
      lot: { lotCode, expirationDate: dateValue(expiry) ?? null, tradeItemId },
    };
  }

  const line = lines.find(
    (candidate) =>
      candidate.orderable.id === product.orderable.id && sameLot(candidate.lot, card.lot),
  );
  const action: ScanAction<Card | PendingScanCard<Card>> = line
    ? { type: 'count', lineKey: line.key }
    : { type: 'add', card };
  const recorded = dateValue(card.lot?.expirationDate);
  const scanned = dateValue(scan.expiry);
  if (policy.tracksLots !== false && recorded && scanned && recorded !== scanned) {
    return {
      type: 'confirm-expiry',
      recorded,
      scanned,
      next: action,
    };
  }
  return action;
}
