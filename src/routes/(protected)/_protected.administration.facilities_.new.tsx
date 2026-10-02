import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorFallback } from '@/components/error-fallback';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { createFacility } from '@/features/facilities/api/api';
import {
  FacilityEditor,
  FacilityEditorSkeleton,
  prefetchFacilityEditorLookups,
} from '@/features/facilities/components/facility-editor';
import {
  EMPTY_FACILITY_FORM,
  type FacilityTab,
  facilityEditorSearchSchema,
  toFacilityBody,
} from '@/features/facilities/lib/facility-form';
import { queryKeys } from '@/lib/key-factory';

export const Route = createFileRoute('/(protected)/_protected/administration/facilities_/new')({
  validateSearch: facilityEditorSearchSchema,
  staticData: { crumbKey: 'facilities.form.create-title' },
  loader: async ({ context: { queryClient } }) => {
    await requireRight(queryClient, RIGHTS.facilitiesManage);
    prefetchFacilityEditorLookups(queryClient);
  },
  pendingComponent: AddFacilityPending,
  errorComponent: AddFacilityError,
  component: AddFacilityPage,
});

function AddFacilityPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const tab: FacilityTab = Route.useSearch({ select: (search) => search.tab ?? 'information' });
  const [listSearch] = useState(() => router.state.location.state.facilitiesListSearch ?? {});
  const backToList = useCallback(
    () => navigate({ to: '/administration/facilities', search: listSearch }),
    [navigate, listSearch],
  );

  return (
    <FacilityEditor
      description={t('facilities.form.create-description')}
      discardDescription={t('facilities.form.discard-description')}
      initialValues={EMPTY_FACILITY_FORM}
      onCancel={backToList}
      onSaved={(saved) => {
        toast.success(t('facilities.form.created-title'), {
          description: t('facilities.form.created', { name: saved.name || saved.code }),
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.facilities.all });
        void backToList();
      }}
      onTabChange={(next) =>
        navigate({
          search: { tab: next === 'information' ? undefined : next },
          replace: true,
          state: (previous) => previous,
        })
      }
      save={(values) => createFacility(toFacilityBody(values))}
      submitLabel={t('facilities.form.create')}
      tab={tab}
      title={t('facilities.form.create-title')}
    />
  );
}

function AddFacilityPending() {
  const { t } = useTranslation();
  return (
    <FacilityEditorSkeleton
      description={t('facilities.form.create-description')}
      title={t('facilities.form.create-title')}
    />
  );
}

function AddFacilityError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <ErrorFallback
      {...props}
      description={t('facilities.error-description')}
      title={t('facilities.form.load-error-title')}
    />
  );
}
