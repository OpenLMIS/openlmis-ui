import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorFallback } from '@/components/app-shell/error-fallback';
import { prefetchFacilityProgramOptions } from '@/components/pickers/facility-program-selector/use-facility-program-options';
import { permissionsOptions } from '@/features/auth/api/queries';
import { ForbiddenError, requirePermissions } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import { catalogItemsOptions } from '@/features/cce-inventory/api/queries';
import {
  InventoryItemEditor,
  type SavedInventoryItem,
} from '@/features/cce-inventory/components/inventory-item-editor';
import { InventoryItemEditorSkeleton } from '@/features/cce-inventory/components/inventory-item-editor-skeleton';
import { editableGrants } from '@/features/cce-inventory/lib/grants';
import { inventorySavedSearch } from '@/features/cce-inventory/lib/search';
import { facilityProgramSearchSchema } from '@/lib/facility-program-selection';

export const Route = createFileRoute('/(protected)/_protected/cce/inventory_/new')({
  staticData: {
    crumbKey: 'cce-inventory.form.title',
    crumbParentSearch: (search) => facilityProgramSearchSchema.parse(search),
  },
  validateSearch: facilityProgramSearchSchema,
  preload: false,
  loader: async ({ context: { queryClient } }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    const permissions = await requirePermissions(queryClient, RIGHTS.cceInventoryEdit);
    if (editableGrants(permissions).length === 0) {
      throw new ForbiddenError([RIGHTS.cceInventoryEdit, RIGHTS.cceInventoryView]);
    }
    if (!userId || useLoginData.getState().referenceDataUserId !== userId) return;
    prefetchFacilityProgramOptions(queryClient, userId);
    queryClient.prefetchQuery({ ...catalogItemsOptions(), staleTime: 0 });
  },
  pendingComponent: InventoryItemEditorSkeleton,
  errorComponent: AddEquipmentError,
  component: AddEquipmentPage,
});

function AddEquipmentPage() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  return userId ? <AddEquipmentContent userId={userId} /> : null;
}

function AddEquipmentContent({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const pair = Route.useSearch();
  const [listSearch] = useState(() => router.state.location.state.inventoryListSearch);
  const { data: permissions } = useSuspenseQuery(permissionsOptions(userId));
  const grants = useMemo(() => editableGrants(permissions), [permissions]);

  const onCancel = () => navigate({ to: '/cce/inventory', search: listSearch ?? pair });
  const onSaved = ({ selection, status, name }: SavedInventoryItem) => {
    toast.success(t('cce-inventory.form.saved-title'), {
      description: t('cce-inventory.form.saved', { name }),
    });
    void navigate({
      to: '/cce/inventory',
      search: inventorySavedSearch(listSearch, selection, status),
    });
  };

  return (
    <InventoryItemEditor
      grants={grants}
      initial={pair}
      onCancel={onCancel}
      onSaved={onSaved}
      userId={userId}
    />
  );
}

function AddEquipmentError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <ErrorFallback
      {...props}
      description={t('cce-inventory.form.load-error')}
      title={t('cce-inventory.form.load-error-title')}
    />
  );
}
