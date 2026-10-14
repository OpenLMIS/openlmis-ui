import {
  createFileRoute,
  type ErrorComponentProps,
  notFound,
  useRouter,
} from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ErrorFallback } from '@/components/error-fallback';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { facilityTypesOptions, programsOptions } from '@/features/reference-data/api/queries';
import { programName } from '@/features/reference-data/lib/programs';
import {
  requisitionTemplateOptions,
  requisitionTemplatesOptions,
  templateReasonTagsOptions,
} from '@/features/requisition-templates/api/queries';
import { TemplateEditor } from '@/features/requisition-templates/components/template-editor';
import { TemplateEditorSkeleton } from '@/features/requisition-templates/components/template-editor-skeleton';
import { isNotFound } from '@/lib/http';

export const Route = createFileRoute(
  '/(protected)/_protected/administration/requisition-templates_/$id',
)({
  staticData: { crumbKey: 'requisition-templates.configure.crumb' },
  preload: false,
  validateSearch: z.object({ tab: z.literal('settings').optional().catch(undefined) }),
  loader: async ({ context: { queryClient }, params, cause }) => {
    if (!z.uuid().safeParse(params.id).success) throw notFound();
    await requireRight(queryClient, RIGHTS.requisitionTemplatesManage);
    const detail = requisitionTemplateOptions(params.id);
    try {
      const [template, programs] = await Promise.all([
        cause === 'stay'
          ? queryClient.ensureQueryData(detail)
          : queryClient.fetchQuery({ ...detail, staleTime: 0 }),
        queryClient.ensureQueryData(programsOptions()),
      ]);
      if (!template.program?.id) throw notFound();
      queryClient.prefetchQuery(templateReasonTagsOptions());
      queryClient.prefetchQuery(facilityTypesOptions());
      queryClient.prefetchQuery(facilityTypesOptions({ active: true }));
      queryClient.prefetchQuery(requisitionTemplatesOptions());
      return { template, program: programs.find((program) => program.id === template.program?.id) };
    } catch (error) {
      if (isNotFound(error)) throw notFound();
      throw error;
    }
  },
  pendingComponent: ConfigurePending,
  errorComponent: ConfigureError,
  component: ConfigurePage,
});

function ConfigurePage() {
  const router = useRouter();
  const navigate = Route.useNavigate();
  const loaded = Route.useLoaderData();
  const [saved] = useState(loaded);
  const { tab } = Route.useSearch();
  return (
    <TemplateEditor
      saved={saved.template}
      programName={saved.program ? programName(saved.program) : ''}
      tab={tab ?? 'columns'}
      onTabChange={(tab) => {
        void navigate({
          search: { tab: tab === 'settings' ? 'settings' : undefined },
          replace: true,
        });
      }}
      onCancel={() => {
        void navigate({ to: '/administration/requisition-templates', search: {} });
      }}
      onSaved={() => {
        void navigate({ to: '/administration/requisition-templates', search: {}, replace: true });
      }}
      key={`${saved.template.id}-${router.state.location.pathname}`}
    />
  );
}

function ConfigurePending() {
  const router = useRouter();
  const search = router.state.location.search as { tab?: 'settings' };
  return <TemplateEditorSkeleton tab={search.tab ?? 'columns'} />;
}

function ConfigureError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <ErrorFallback
      {...props}
      title={t('requisition-templates.configure.load-error-title')}
      description={t('requisition-templates.configure.load-error')}
    />
  );
}
