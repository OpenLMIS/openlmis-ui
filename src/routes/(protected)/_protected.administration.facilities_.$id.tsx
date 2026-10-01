import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router';
import { BuildingIcon, SearchXIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { FieldSkeleton } from '@/components/dialog-parts';
import { ErrorFallback } from '@/components/error-fallback';
import { Block } from '@/components/skeleton-block';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { updateFacility } from '@/features/facilities/api/api';
import {
  FACILITY_EDITOR_LOOKUPS,
  FacilityEditor,
} from '@/features/facilities/components/facility-editor';
import {
  type FacilityTab,
  toFacilityBody,
  toFacilityFormValues,
} from '@/features/facilities/lib/facility-form';
import { facilityOptions } from '@/features/reference-data/api/queries';
import type { Facility } from '@/features/reference-data/lib/types';
import { isNotFound } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';

const editFacilitySearchSchema = z.object({
  tab: z.literal('programs').optional().catch(undefined),
});

export const Route = createFileRoute('/(protected)/_protected/administration/facilities_/$id')({
  validateSearch: editFacilitySearchSchema,
  staticData: { crumbKey: 'facilities.form.edit-title' },
  loader: async ({ context: { queryClient }, params }) => {
    const { types, zones, operators, programs } = FACILITY_EDITOR_LOOKUPS;
    queryClient.prefetchQuery(types);
    queryClient.prefetchQuery(zones);
    queryClient.prefetchQuery(operators);
    queryClient.prefetchQuery(programs);
    // Read fresh, since a save sends the whole record back over whatever is stored.
    await Promise.all([
      requireRight(queryClient, RIGHTS.facilitiesManage),
      queryClient.fetchQuery({ ...facilityOptions(params.id), staleTime: 0 }),
    ]);
  },
  pendingComponent: EditFacilityPending,
  errorComponent: EditFacilityError,
  component: EditFacilityPage,
});

function EditFacilityPage() {
  const { id } = Route.useParams();
  const { data: facility } = useSuspenseQuery(facilityOptions(id));
  return <FacilityEditPage facility={facility} key={facility.id} />;
}

function FacilityEditPage({ facility }: { facility: Facility }) {
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
  const name = facility.name || facility.code;
  const [initialValues] = useState(() => toFacilityFormValues(facility));

  return (
    <FacilityEditor
      description={t('facilities.form.edit-description')}
      discardDescription={t('facilities.form.edit-discard-description', { name })}
      initialValues={initialValues}
      onCancel={backToList}
      onSaved={(saved) => {
        queryClient.setQueryData(facilityOptions(saved.id).queryKey, saved);
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
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <BuildingIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>{t('facilities.form.edit-title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('facilities.form.edit-description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div className="flex flex-col gap-6">
          <Block className="h-9 w-80" />
          <div className="grid gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
            <FieldSkeleton label={t('facilities.form.name')} required />
            <FieldSkeleton label={t('facilities.form.code')} required />
            <FieldSkeleton label={t('facilities.form.type')} required />
            <FieldSkeleton label={t('facilities.form.zone')} required />
            <FieldSkeleton label={t('facilities.form.go-live-date')} required />
            <FieldSkeleton label={t('facilities.form.operator')} />
          </div>
        </div>
      </WorkspaceContent>
    </Workspace>
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
