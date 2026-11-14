import {
  createFileRoute,
  type RegisteredRouter,
  useLocation,
  useNavigate,
} from '@tanstack/react-router';
import { requirePermissions } from '@/features/auth/lib/access';
import { facilityCceOptions } from '@/features/cce-inventory/api/queries';
import { FacilityCceStatus } from '@/features/cce-inventory/components/facility-cce-status';
import {
  orderOptions,
  shipmentDraftOptions,
  shipmentOptions,
  shipmentSummariesOptions,
} from '@/features/orders/api/queries';
import { ShipmentPending, ShipmentScreen } from '@/features/orders/components/shipment-editor';
import { orderReturnTarget } from '@/features/orders/lib/order-return';
import {
  consumeShipmentEntry,
  isFulfillable,
  shipmentStockFilter,
} from '@/features/orders/lib/shipment-entry';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { facilityGrants, programGrants } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export const Route = createFileRoute('/(protected)/_protected/orders/fulfillment_/$orderId')({
  preload: false,
  staticData: { crumbKey: 'orders.shipment.crumb' },
  loader: async ({ context: { queryClient }, params: { orderId }, cause, location }) => {
    const scope = getSessionScope();
    const checked =
      cause === 'enter'
        ? consumeShipmentEntry(queryClient, orderId, location.state.shipmentEntry)
        : undefined;
    const [permissions, order] = await Promise.all([
      requirePermissions(queryClient, [
        RIGHTS.shipmentsView,
        RIGHTS.shipmentsEdit,
        RIGHTS.ordersView,
      ]),
      checked
        ? Promise.resolve(checked)
        : cause === 'enter'
          ? queryClient.fetchQuery({ ...orderOptions(orderId), staleTime: 0 })
          : queryClient.ensureQueryData(orderOptions(orderId)),
    ]);
    assertSessionScope(scope);
    if (!checked) {
      const fresh = cause === 'enter' ? { staleTime: 0 } : {};
      queryClient.prefetchQuery({
        ...shipmentSummariesOptions(shipmentStockFilter(order)),
        ...fresh,
      });
      queryClient.prefetchQuery({
        ...(isFulfillable(order) ? shipmentDraftOptions(orderId) : shipmentOptions(orderId)),
        ...fresh,
      });
    }
    queryClient.prefetchQuery(deploymentTimeZoneOptions());
    const at = (right: string, facility: string) =>
      facilityGrants(permissions, right).some((grant) => grant.facilityId === facility);
    const canEdit = at(RIGHTS.shipmentsEdit, order.supplyingFacility.id);
    const canViewCce = programGrants(permissions, RIGHTS.cceInventoryView).some(
      (grant) => grant.facilityId === order.requestingFacility.id,
    );
    if (canViewCce) queryClient.prefetchQuery(facilityCceOptions(order.requestingFacility.id));
    return {
      order,
      canViewCce,
      access: {
        canEdit,
        canCancel: at(RIGHTS.ordersEdit, order.supplyingFacility.id),
        canPrint:
          canEdit &&
          [RIGHTS.ordersView, RIGHTS.shipmentsView, RIGHTS.stockCardsView].every((right) =>
            permissions.rights.has(right),
          ),
      },
    };
  },
  pendingComponent: ShipmentPending,
  component: ShipmentPage,
});
function ShipmentPage() {
  const { order, access, canViewCce } = Route.useLoaderData();
  const navigate = useNavigate();
  const state = useLocation({ select: (location) => location.state });
  return (
    <ShipmentScreen
      orderId={order.id}
      access={access}
      onReturn={() =>
        navigate<RegisteredRouter, string, string>(
          orderReturnTarget(state, { to: '/orders/fulfillment' as const, search: {} }),
        )
      }
      cceStatus={
        <FacilityCceStatus facilityId={order.requestingFacility.id} canView={canViewCce} />
      }
    />
  );
}
