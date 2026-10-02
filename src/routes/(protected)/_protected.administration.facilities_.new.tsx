import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { BuildingIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { FieldSkeleton } from '@/components/dialog-parts';
import { ErrorFallback } from '@/components/error-fallback';
import { Block } from '@/components/skeleton-block';
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
import { createFacility } from '@/features/facilities/api/api';
import {
  FACILITY_EDITOR_LOOKUPS,
  FacilityEditor,
} from '@/features/facilities/components/facility-editor';
import {
  EMPTY_FACILITY_FORM,
  type FacilityTab,
  toFacilityBody,
} from '@/features/facilities/lib/facility-form';
import { queryKeys } from '@/lib/key-factory';

const addFacilitySearchSchema = z.object({
  tab: z.literal('programs').optional().catch(undefined),
});

export const Route = createFileRoute('/(protected)/_protected/administration/facilities_/new')({
  validateSearch: addFacilitySearchSchema,
  staticData: { crumbKey: 'facilities.form.create-title' },
  loader: async ({ context: { queryClient } }) => {
    await requireRight(queryClient, RIGHTS.facilitiesManage);
    const { types, zones, operators, programs } = FACILITY_EDITOR_LOOKUPS;
    queryClient.prefetchQuery(types);
    queryClient.prefetchQuery(zones);
    queryClient.prefetchQuery(operators);
    queryClient.prefetchQuery(programs);
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
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <BuildingIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>{t('facilities.form.create-title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('facilities.form.create-description')}</WorkspaceDescription>
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
            <FieldSkeleton label={t('facilities.form.go-live-date')} />
            <FieldSkeleton label={t('facilities.form.operator')} />
          </div>
        </div>
      </WorkspaceContent>
    </Workspace>
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
