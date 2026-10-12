import { describe, expect, it } from 'vitest';
import type { OrderableChild, Reason } from '@/features/reference-data/lib/types';
import {
  contentTotalsTooLarge,
  expandKitLines,
  kitContentsChanged,
  kitContentsProblem,
  unpackReasons,
  withFreshContents,
} from '@/features/stock-events/lib/kit-unpack';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const children = [
  { orderable: { id: 'child-a' }, quantity: 2 },
  { orderable: { id: 'child-b' }, quantity: 5 },
];
const kit = { id: 'kit', children };
const reasons = deepFreeze({ debit: 'debit', credit: 'credit' });
const item = (quantity: number, lotId: string | null = null) => ({
  orderableId: 'kit',
  lotId,
  quantity,
  occurredDate: '2026-10-12',
  extraData: {},
  children,
});
const debit: Reason = {
  id: 'debit',
  name: 'Unpack Kit',
  reasonType: 'DEBIT',
  reasonCategory: 'AGGREGATION',
  isFreeTextAllowed: false,
  tags: [],
};
const credit: Reason = { ...debit, id: 'credit', reasonType: 'CREDIT' };
const ids = { kitUnpackReasonId: 'debit', unpackedFromKitReasonId: 'credit' };

describe('unpackReasons', () => {
  it('resolves both aggregation reasons without mutating the list or settings', () => {
    expect(unpackReasons(deepFreeze([debit, credit]), deepFreeze(ids))).toEqual({
      ok: true,
      ...reasons,
    });
  });
  it.each([undefined, '', '  ', 'unknown'])(
    'refuses missing or unknown debit id %s first',
    (id) => {
      expect(unpackReasons([debit, credit], { kitUnpackReasonId: id })).toEqual({
        ok: false,
        setting: 'KIT_UNPACK_REASON_ID',
      });
    },
  );
  it('refuses reasons before the list is available', () => {
    expect(unpackReasons(undefined, ids)).toEqual({ ok: false, setting: 'KIT_UNPACK_REASON_ID' });
  });
  it.each(['DEBIT', 'CREDIT'])('checks the type and category of the %s reason', (type) => {
    const setting = type === 'DEBIT' ? 'KIT_UNPACK_REASON_ID' : 'UNPACKED_FROM_KIT_REASON_ID';
    for (const patch of [{ reasonType: 'BALANCE_ADJUSTMENT' }, { reasonCategory: 'TRANSFER' }]) {
      const list = [debit, credit].map((reason) =>
        reason.reasonType === type ? { ...reason, ...patch } : reason,
      );
      expect(unpackReasons(list, ids)).toEqual({ ok: false, setting });
    }
    const list = [debit, credit].map((reason) =>
      reason.reasonType === type
        ? { ...reason, reasonType: type === 'DEBIT' ? 'CREDIT' : 'DEBIT' }
        : reason,
    );
    expect(unpackReasons(list, ids)).toEqual({ ok: false, setting });
  });
  it.each([undefined, '', '  ', 'unknown'])('refuses missing or unknown credit id %s', (id) => {
    expect(unpackReasons([debit, credit], { ...ids, unpackedFromKitReasonId: id })).toEqual({
      ok: false,
      setting: 'UNPACKED_FROM_KIT_REASON_ID',
    });
  });
});

describe('kitContentsProblem', () => {
  it.each([undefined, []])('refuses a product without contents %s', (children) => {
    expect(kitContentsProblem(deepFreeze({ children }))).toBe('not-a-kit');
  });
  it.each([null, -1, 1.5, 2_147_483_648, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses invalid child count %s',
    (quantity) => {
      expect(
        kitContentsProblem(deepFreeze({ children: [{ orderable: { id: 'child' }, quantity }] })),
      ).toBe('invalid-count');
    },
  );
  it('allows zero and the Java int maximum', () => {
    expect(
      kitContentsProblem(
        deepFreeze({
          children: [
            { orderable: { id: 'zero' }, quantity: 0 },
            { orderable: { id: 'max' }, quantity: 2_147_483_647 },
          ],
        }),
      ),
    ).toBeUndefined();
  });
});

describe('expandKitLines', () => {
  it('expands each repeated kit separately from doses, keeping lots, dates, VVM and zero credits', () => {
    const input = deepFreeze([
      {
        ...item(32, 'lot'),
        occurredDate: '2026-10-11',
        extraData: { vvmStatus: 'STAGE_1' as const },
      },
      { ...item(3), children: [...children, { orderable: { id: 'zero' }, quantity: 0 }] },
    ]);
    const lineItems = deepFreeze(input.map(({ children: _children, ...item }) => item));
    const output = expandKitLines(
      lineItems,
      input.map((item) => item.children),
      reasons,
    );
    expect(output).toEqual([
      {
        orderableId: 'kit',
        lotId: 'lot',
        quantity: 32,
        occurredDate: '2026-10-11',
        reasonId: 'debit',
        extraData: { vvmStatus: 'STAGE_1' },
      },
      {
        orderableId: 'kit',
        lotId: null,
        quantity: 3,
        occurredDate: '2026-10-12',
        reasonId: 'debit',
        extraData: {},
      },
      {
        orderableId: 'child-a',
        lotId: null,
        quantity: 64,
        occurredDate: '2026-10-11',
        reasonId: 'credit',
        extraData: {},
      },
      {
        orderableId: 'child-b',
        lotId: null,
        quantity: 160,
        occurredDate: '2026-10-11',
        reasonId: 'credit',
        extraData: {},
      },
      {
        orderableId: 'child-a',
        lotId: null,
        quantity: 6,
        occurredDate: '2026-10-12',
        reasonId: 'credit',
        extraData: {},
      },
      {
        orderableId: 'child-b',
        lotId: null,
        quantity: 15,
        occurredDate: '2026-10-12',
        reasonId: 'credit',
        extraData: {},
      },
      {
        orderableId: 'zero',
        lotId: null,
        quantity: 0,
        occurredDate: '2026-10-12',
        reasonId: 'credit',
        extraData: {},
      },
    ]);
    expect(output[0]).not.toBe(lineItems[0]);
  });
});

describe('contentTotalsTooLarge', () => {
  const shared = [{ orderable: { id: 'shared' }, quantity: 1 }];
  it('accepts the limit and returns every contributing index above it, excluding other products and zero counts', () => {
    const lines = deepFreeze([
      { ...item(2_147_483_646), children: shared },
      { ...item(1), orderableId: 'another-kit', children: shared },
      { ...item(1), children: [{ orderable: { id: 'other' }, quantity: 1 }] },
      { ...item(1), children: [{ orderable: { id: 'shared' }, quantity: 0 }] },
    ]);
    expect(contentTotalsTooLarge(lines)).toEqual([]);
    expect(contentTotalsTooLarge(deepFreeze([...lines, { ...item(1), children: shared }]))).toEqual(
      [0, 1, 4],
    );
  });
  it('sums duplicate child entries too', () => {
    expect(
      contentTotalsTooLarge(
        deepFreeze([{ ...item(1_073_741_824), children: [...shared, ...shared] }]),
      ),
    ).toEqual([0]);
  });
});

describe('fresh kit contents', () => {
  const line = { key: 'line', orderable: kit, quantity: { doses: '2' }, lot: { id: 'lot' } };
  it('compares child ids and counts as multisets, including duplicate multiplicity', () => {
    const lines = deepFreeze([line, { ...line, key: 'second' }]);
    expect(
      kitContentsChanged(lines, deepFreeze([{ ...kit, children: [...children].reverse() }])),
    ).toEqual([]);
    for (const fresh of [
      [{ ...kit, children: [...children, children[0]] }],
      [{ ...kit, children: [children[0]] }],
      [{ ...kit, children: [{ ...children[0], quantity: 3 }, children[1]] }],
      [{ ...kit, children: [{ ...children[0], orderable: { id: 'new' } }, children[1]] }],
      [{ ...kit, children: [] }],
      [],
    ]) {
      expect(kitContentsChanged(lines, deepFreeze(fresh))).toEqual(['kit']);
    }
    const duplicate = { ...kit, children: [children[0], children[0], children[1]] };
    expect(
      kitContentsChanged(
        [{ orderable: duplicate }],
        [{ ...duplicate, children: [children[0], children[1], children[1]] }],
      ),
    ).toEqual(['kit']);
  });
  it('reports a missing kit once, then lets validation refuse the refreshed line', () => {
    const lines = deepFreeze([line]);
    expect(kitContentsChanged(lines, [])).toEqual(['kit']);
    const updated = withFreshContents(lines, []);
    expect(kitContentsChanged(updated, [])).toEqual([]);
    expect(kitContentsProblem(updated[0].orderable)).toBe('not-a-kit');
  });
  it('replaces only contents on new lines and orderables without mutating frozen inputs', () => {
    const lines = deepFreeze([line]);
    const fresh = deepFreeze([
      { ...kit, productCode: 'new-code', children: [{ orderable: { id: 'new' }, quantity: 4 }] },
    ]);
    const result = withFreshContents(lines, fresh);
    expect(result).toEqual([{ ...line, orderable: { ...kit, children: fresh[0].children } }]);
    expect(result[0]).not.toBe(line);
    expect(result[0].orderable).not.toBe(kit);
    expect(result[0].quantity).toBe(line.quantity);
    expect(result[0].lot).toBe(line.lot);
    expect(withFreshContents(lines, [])[0].orderable.children).toBeUndefined();
  });
  it('retains invalid fresh counts so validation can refuse them and later recover', () => {
    const freshChildren: OrderableChild[] = [{ orderable: { id: 'child' }, quantity: null }];
    const updated = withFreshContents(
      deepFreeze([line]),
      deepFreeze([{ ...kit, children: freshChildren }]),
    );
    expect(kitContentsProblem(updated[0].orderable)).toBe('invalid-count');
    expect(kitContentsProblem(withFreshContents(updated, [kit])[0].orderable)).toBeUndefined();
  });
});
