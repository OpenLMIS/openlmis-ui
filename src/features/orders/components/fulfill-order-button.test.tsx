import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { FulfillOrderButton } from '@/features/orders/components/order-row-buttons';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { orderSummary } from '@/test-utils/order-fixtures';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it.each(['ORDERED', 'FULFILLING'])(
  'guards the %s legacy shipment hand-off under /v2/',
  async (status) => {
    vi.stubEnv('BASE_URL', '/v2/');
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const ask = vi.fn();
    function Guarded() {
      useLeaveGuard(true, ask);
      return <FulfillOrderButton order={{ ...orderSummary('a'), status }} disabled={false} />;
    }
    render(<Guarded />);
    await userEvent.click(screen.getByRole('button'));
    expect(ask).toHaveBeenCalledWith(expect.any(Function), 'leave');
    expect(assign).not.toHaveBeenCalled();
    ask.mock.calls[0][0]();
    expect(assign).toHaveBeenCalledExactlyOnceWith('/#!/orders/a/shipment');
  },
);
