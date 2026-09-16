// import { client } from '@/integrations/axios';
import type { StockMovementInput } from '@/features/stock-movement/lib/types';

/*
  TODO: Replace the mock with a real POST /stock-movements call. Throw
  `CreateStockMovementError` for 4xx domain failures so the wizard can
  surface the message via toast without special-casing each status code.
*/
export class CreateStockMovementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreateStockMovementError';
  }
}

export type CreatedStockMovement = { id: string };

export async function createStockMovement(
  input: StockMovementInput,
): Promise<CreatedStockMovement> {
  // Real implementation:
  //   const res = await client.post<CreatedStockMovement>('/stock-movements', input);
  //   return res.data;

  // Mock latency so the loading state is visible during the demo.
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Demo failure gate: a referenceCode starting with "FAIL-" trips the
  // error path so reviewers can see the toast end-to-end.
  if (input.referenceCode.trim().toUpperCase().startsWith('FAIL-')) {
    throw new CreateStockMovementError('A movement with that reference already exists.');
  }

  return { id: `mov_${Date.now().toString(36)}` };
}
