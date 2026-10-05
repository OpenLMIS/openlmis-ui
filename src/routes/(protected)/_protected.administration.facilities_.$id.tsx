import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router';
import { SearchXIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorFallback } from '@/components/error-fallback';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Workspace, WorkspaceContent } from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { updateFacility } from '@/features/facilities/api/api';
import {
  FacilityEditor,
  FacilityEditorSkeleton,
  prefetchFacilityEditorLookups,
} from '@/features/facilities/components/facility-editor';
import {
  type FacilityTab,
  facilityEditorSearchSchema,
  toFacilityBody,
  toFacilityFormValues,
} from '@/features/facilities/lib/facility-form';
import { facilityOptions } from '@/features/reference-data/api/queries';
import { isNotFound } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';

export const Route = createFileRoute('/(protected)/_protected/administration/facilities_/$id')({
  validateSearch: facilityEditorSearchSchema,
  staticData: { crumbKey: 'facilities.form.edit-title' },
  // A preloaded page would open on the copy read at hover, and the save sends the whole record back.
  preload: false,
  loader: async ({ context: { queryClient }, params }) => {
    await Promise.all([
      requireRight(queryClient, RIGHTS.facilitiesManage),
      queryClient.fetchQuery({ ...facilityOptions(params.id), staleTime: 0 }),
    ]);
    prefetchFacilityEditorLookups(queryClient);
  },
  pendingComponent: EditFacilityPending,
  errorComponent: EditFacilityError,
  component: EditFacilityPage,
});

function EditFacilityPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const { id } = Route.useParams();
  const { data: facility } = useSuspenseQuery(facilityOptions(id));
  const tab: FacilityTab = Route.useSearch({ select: (search) => search.tab ?? 'information' });
  const [listSearch] = useState(() => router.state.location.state.facilitiesListSearch ?? {});
  const backToList = useCallback(
    () => navigate({ to: '/administration/facilities', search: listSearch }),
    [navigate, listSearch],
  );
  const name = facility.name || facility.code;

  return (
    <FacilityEditor
      description={t('facilities.form.edit-description')}
      discardDescription={t('facilities.form.edit-discard-description', { name })}
      initialValues={toFacilityFormValues(facility)}
      key={facility.id}
      onCancel={backToList}
      onSaved={(saved) => {
        toast.success(t('facilities.form.saved-title'), {
          description: t('facilities.form.saved', { name: saved.name || saved.code }),
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
      save={(values) => updateFacility(facility.id, toFacilityBody(values, facility))}
      saved={facility}
      submitLabel={t('facilities.form.save')}
      tab={tab}
      title={t('facilities.form.edit-heading', { name })}
    />
  );
}

function EditFacilityPending() {
  const { t } = useTranslation();
  return (
    <FacilityEditorSkeleton
      description={t('facilities.form.edit-description')}
      goLiveDateRequired
      title={t('facilities.form.edit-title')}
    />
  );
}

function EditFacilityError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  if (!isNotFound(props.error)) {
    return (
      <ErrorFallback
        {...props}
        description={t('facilities.form.load-facility-error-description')}
        title={t('facilities.form.load-facility-error-title')}
      />
    );
  }

  return (
    <Workspace>
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>{t('facilities.form.not-found-title')}</EmptyTitle>
            <EmptyDescription>{t('facilities.form.not-found-description')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              nativeButton={false}
              render={<Link to="/administration/facilities" />}
              variant="outline"
            >
              {t('facilities.form.back')}
            </Button>
          </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
