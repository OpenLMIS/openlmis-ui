import { deleteOrders, fetchOrder, saveOrder, sendOrder } from '@/features/orders/api/api';
import { type DraftLine, orderBody } from '@/features/orders/lib/order-draft';
import type { OrderProblem } from '@/features/orders/lib/order-load';
import type { Order } from '@/features/orders/lib/types';
import { isNotFound } from '@/lib/http';
import { assertSessionScope, getSessionScope, SessionEndedError } from '@/lib/session-scope';
import { settleFew } from '@/lib/settle-few';

export type OrderSnapshot = { order: Order; lines: DraftLine[] };
export type WriteAction =
  | { kind: 'save' | 'send'; snapshots: OrderSnapshot[] }
  | { kind: 'delete'; ids: string[] };
export type OrderOutcome = {
  id: string;
  response?: Order;
  error?: unknown;
  problem?: OrderProblem;
  success: boolean;
};
export async function executeOrderWrite(action: WriteAction): Promise<OrderOutcome[]> {
  const scope = getSessionScope();
  const recover = async (id: string, error: unknown, uncertain: boolean): Promise<OrderOutcome> => {
    try {
      const order = await fetchOrder(id);
      assertSessionScope(scope);
      return {
        id,
        error,
        success: false,
        ...(order.status !== 'CREATING' && { problem: 'not-creating' as const }),
      };
    } catch (readError) {
      if (readError instanceof SessionEndedError) throw readError;
      assertSessionScope(scope);
      return {
        id,
        error,
        success: false,
        ...(isNotFound(readError)
          ? { problem: 'not-found' as const }
          : uncertain
            ? { problem: 'unresolved' as const }
            : {}),
      };
    }
  };
  if (action.kind === 'delete') {
    try {
      await deleteOrders(action.ids);
      assertSessionScope(scope);
      return action.ids.map((id) => ({ id, success: true }));
    } catch (error) {
      if (error instanceof SessionEndedError) throw error;
      assertSessionScope(scope);
      if (!isNotFound(error)) return action.ids.map((id) => ({ id, error, success: false }));
      const results = await settleFew(action.ids, (id) => recover(id, error, false));
      assertSessionScope(scope);
      return [
        ...results.done,
        ...results.failed.map((id) => ({ id, success: false, error: results.error })),
      ];
    }
  }
  const kind = action.kind;
  const results = await settleFew(action.snapshots, async (snapshot) => {
    const id = snapshot.order.id;
    try {
      const body = orderBody(snapshot.order, snapshot.lines);
      const response = kind === 'save' ? await saveOrder(body) : await sendOrder(body);
      assertSessionScope(scope);
      return { id, success: true, ...(response && { response }) };
    } catch (error) {
      if (error instanceof SessionEndedError) throw error;
      assertSessionScope(scope);
      return recover(id, error, kind === 'send');
    }
  });
  assertSessionScope(scope);
  return [
    ...results.done,
    ...results.failed.map((snapshot) => ({
      id: snapshot.order.id,
      success: false,
      error: results.error,
    })),
  ];
}
