import {
  createFileRoute,
  type ErrorComponentProps,
  notFound,
  useRouter,
} from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ErrorFallback } from '@/components/app-shell/error-fallback';
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
    if (!z.guid().safeParse(params.id).success) throw notFound();
    const detail = requisitionTemplateOptions(params.id);
    try {
      const [template, programs] = await Promise.all([
        cause === 'stay'
          ? queryClient.ensureQueryData(detail)
          : queryClient.fetchQuery({ ...detail, staleTime: 0 }),
        queryClient.ensureQueryData(programsOptions()),
        requireRight(queryClient, RIGHTS.requisitionTemplatesManage),
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
  const loaded = Route.useLoaderData();
  return <ConfigureRecord key={loaded.template.id} loaded={loaded} />;
}

function ConfigureRecord({ loaded }: { loaded: ReturnType<typeof Route.useLoaderData> }) {
  const navigate = Route.useNavigate();
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
    />
  );
}

function ConfigurePending() {
  const router = useRouter();
  const search = router.state.location.search as { tab?: 'settings' };
  const { t } = useTranslation();
  const { queryClient } = router.options.context;
  const id = router.state.location.pathname.split('/').at(-1) ?? '';
  const template = queryClient.getQueryData(requisitionTemplateOptions(id).queryKey);
  const program = queryClient
    .getQueryData(programsOptions().queryKey)
    ?.find((program) => program.id === template?.program?.id);
  return (
    <TemplateEditorSkeleton
      tab={search.tab ?? 'columns'}
      title={
        template
          ? t('requisition-templates.configure.title', {
              template: template.name,
              program: program ? programName(program) : '',
            })
          : undefined
      }
    />
  );
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
