import { createFileRoute } from '@tanstack/react-router';
import { ClipboardListIcon, PlusIcon } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ListError } from '@/components/list-error';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import {
  Workspace,
  WorkspaceActions,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { facilityTypesOptions, programsOptions } from '@/features/reference-data/api/queries';
import { requisitionTemplatesOptions } from '@/features/requisition-templates/api/queries';
import { ProgramTemplateSections } from '@/features/requisition-templates/components/program-templates';
import { TemplatesSkeleton } from '@/features/requisition-templates/components/templates-skeleton';
import { useCardLayout } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const searchSchema = z.object({ template: z.literal('new').optional().catch(undefined) });
type TemplatesSearch = z.infer<typeof searchSchema>;
const CLOSED_DIALOGS = { template: undefined } satisfies Partial<TemplatesSearch>;
const loadDialog = () => import('@/features/requisition-templates/components/add-template-dialog');
const AddTemplateDialog = lazy(() =>
  loadDialog().then((module) => ({ default: module.AddTemplateDialog })),
);

export const Route = createFileRoute(
  '/(protected)/_protected/administration/requisition-templates',
)({
  validateSearch: searchSchema,
  loader: async ({ context: { queryClient } }) => {
    await requireRight(queryClient, RIGHTS.requisitionTemplatesManage);
    queryClient.prefetchQuery(requisitionTemplatesOptions());
    queryClient.prefetchQuery(programsOptions());
    queryClient.prefetchQuery(facilityTypesOptions());
  },
  pendingComponent: TemplatesPagePending,
  component: TemplatesPage,
});

function TemplatesHeader({ pending = false, onAdd }: { pending?: boolean; onAdd?: () => void }) {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ClipboardListIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('requisition-templates.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('requisition-templates.description')}</WorkspaceDescription>
      </WorkspaceHeading>
      <WorkspaceActions>
        <Button disabled={pending} onClick={onAdd} size="lg">
          <PlusIcon data-icon="inline-start" />
          {t('requisition-templates.add')}
        </Button>
      </WorkspaceActions>
    </WorkspaceHeader>
  );
}

function TemplatesPage() {
  const { t } = useTranslation();
  const target = Route.useSearch({ select: (search) => search.template });
  const { openDialog, closeDialog } = useSearchNavigation<TemplatesSearch>(CLOSED_DIALOGS);
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const [dialogMounted, setDialogMounted] = useState(target !== undefined);
  if (target !== undefined && !dialogMounted) setDialogMounted(true);
  useEffect(() => {
    void loadDialog();
  }, []);
  return (
    <Workspace width="narrow">
      <TemplatesHeader onAdd={() => void openDialog({ template: 'new' })} />
      <WorkspaceContent>
        <div ref={measure}>
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                title={t('requisition-templates.error-title')}
                description={t('requisition-templates.error-description')}
                error={error}
                reset={reset}
              />
            )}
            pendingFallback={<TemplatesSkeleton cards={cards} />}
            resetKey="requisition-templates"
          >
            <ProgramTemplateSections cards={cards} />
          </QueryBoundary>
        </div>
        {dialogMounted && (
          <Suspense fallback={null}>
            <AddTemplateDialog target={target} onClose={closeDialog} />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function TemplatesPagePending() {
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <Workspace width="narrow">
      <TemplatesHeader pending />
      <WorkspaceContent>
        <div ref={measure}>
          <TemplatesSkeleton cards={cards} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
