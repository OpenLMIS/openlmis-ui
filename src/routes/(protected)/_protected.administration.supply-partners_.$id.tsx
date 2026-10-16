import { useQueryClient } from '@tanstack/react-query';
import {
  createFileRoute,
  type ErrorComponentProps,
  redirect,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
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
  EmptyTitle,
} from '@/components/ui/empty';
import { Workspace, WorkspaceContent } from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { supplyPartnerOptions } from '@/features/supply-partners/api/queries';
import {
  SupplyPartnerEditor,
  SupplyPartnerEditorSkeleton,
  SupplyPartnerHeading,
} from '@/features/supply-partners/components/supply-partner-editor';
import {
  type SupplyPartnerEditSearch,
  supplyPartnerEditSearchSchema,
  supplyPartnerListSearch,
} from '@/features/supply-partners/lib/search';
import type { SupplyPartner } from '@/features/supply-partners/lib/types';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { isNotFound } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { SearchChange } from '@/lib/table-search';

const CLOSED = {
  view: undefined,
  viewAssociation: undefined,
  association: undefined,
  products: undefined,
};
const CLOSED_PRODUCTS = { products: undefined };
export const Route = createFileRoute('/(protected)/_protected/administration/supply-partners_/$id')(
  {
    validateSearch: supplyPartnerEditSearchSchema,
    staticData: {
      crumbKey: 'supply-partners.edit',
      crumbParentSearch: (search) =>
        supplyPartnerListSearch(supplyPartnerEditSearchSchema.parse(search)),
    },
    preload: false,
    beforeLoad: ({ search, cause, params }) => {
      const products =
        search.association && !(cause === 'enter' && search.association === 'new')
          ? search.products
          : undefined;
      const view = search.association ? undefined : search.view;
      const viewAssociation = view ? search.viewAssociation : undefined;
      if (
        products !== search.products ||
        view !== search.view ||
        viewAssociation !== search.viewAssociation
      )
        throw redirect({
          to: '/administration/supply-partners/$id',
          params,
          search: { ...search, products, view, viewAssociation },
          replace: true,
        });
    },
    loader: async ({ context: { queryClient }, params, cause }) => {
      const rights = await requireRight(queryClient, RIGHTS.supplyPartnersManage);
      const options = supplyPartnerOptions(params.id);
      const saved = await (cause === 'stay'
        ? queryClient.ensureQueryData(options)
        : queryClient.fetchQuery({ ...options, staleTime: 0 }));
      return {
        saved,
        readAt: queryClient.getQueryState(options.queryKey)?.dataUpdatedAt ?? 0,
        canManageNodes: rights.has(RIGHTS.supervisoryNodesManage),
      };
    },
    component: EditorPage,
    pendingComponent: EditorPending,
    errorComponent: EditorError,
  },
);
function EditorPage() {
  const initial = Route.useLoaderData();
  return <EditorEntry key={initial.saved.id} initial={initial} />;
}
function EditorEntry({
  initial,
}: {
  initial: { saved: SupplyPartner; readAt: number; canManageNodes: boolean };
}) {
  const { t } = useTranslation();
  const [entry, setEntry] = useState(() => ({ saved: initial.saved, readAt: initial.readAt }));
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate({ from: Route.fullPath });
  const [listSearch] = useState(
    () => router.state.location.state.supplyPartnersListSearch ?? supplyPartnerListSearch(search),
  );
  const { openDialog, closeDialog } = useSearchNavigation<SupplyPartnerEditSearch>(CLOSED);
  const productsNavigation = useSearchNavigation<SupplyPartnerEditSearch>(CLOSED_PRODUCTS);
  const back = () =>
    navigate({
      to: '/administration/supply-partners',
      search: { page: listSearch.page, size: listSearch.size },
    });
  const onSearchChange = useCallback<SearchChange<SupplyPartnerEditSearch>>(
    (update, replace = false, options) => {
      void navigate({
        to: '.',
        search: (old) => ({ ...old, ...(typeof update === 'function' ? update(old) : update) }),
        state: (old) => old,
        replace,
        resetScroll: options?.resetScroll ?? false,
      });
    },
    [navigate],
  );
  const onInvalidProducts = useCallback(() => {
    void navigate({
      to: '.',
      search: (old) => ({ ...old, products: undefined }),
      state: (old) => ({ ...old, dialogOpenedHere: false }),
      replace: true,
      resetScroll: false,
    });
  }, [navigate]);
  return (
    <SupplyPartnerEditor
      key={`${entry.saved.id}:${entry.readAt}`}
      saved={entry.saved}
      search={search}
      onSearchChange={onSearchChange}
      onView={(kind, key) => void openDialog({ view: kind, viewAssociation: key })}
      onCloseView={closeDialog}
      canManageNodes={initial.canManageNodes}
      onAssociation={(key) => void openDialog({ association: key })}
      onCloseAssociation={closeDialog}
      onOpenProducts={() => void productsNavigation.openDialog({ products: true })}
      onCloseProducts={productsNavigation.closeDialog}
      onInvalidProducts={onInvalidProducts}
      onCancel={() => void back()}
      onSaved={async (saved) => {
        if (saved) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.supplyPartners.all });
          toast.success(t('supply-partners.updated-title'), {
            description: t('supply-partners.updated'),
          });
        }
        await back();
      }}
      onReload={async () => {
        const scope = getSessionScope();
        const saved = await queryClient.fetchQuery({
          ...supplyPartnerOptions(entry.saved.id),
          staleTime: 0,
        });
        assertSessionScope(scope);
        await navigate({
          to: '.',
          search: (old) => ({ ...old, ...CLOSED }),
          state: (old) => old,
          replace: true,
          resetScroll: false,
        });
        assertSessionScope(scope);
        setEntry({ saved, readAt: Math.max(Date.now(), entry.readAt + 1) });
      }}
    />
  );
}
function EditorPending() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  return (
    <SupplyPartnerEditorSkeleton
      search={search}
      onBack={() =>
        void navigate({
          to: '/administration/supply-partners',
          search:
            router.state.location.state.supplyPartnersListSearch ?? supplyPartnerListSearch(search),
        })
      }
    />
  );
}
function EditorError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = useNavigate();
  const back = (
    <Button
      variant="outline"
      onClick={() =>
        void navigate({
          to: '/administration/supply-partners',
          search:
            router.state.location.state.supplyPartnersListSearch ??
            supplyPartnerListSearch(
              supplyPartnerEditSearchSchema.parse(router.state.location.search),
            ),
        })
      }
    >
      {t('supply-partners.back')}
    </Button>
  );
  if (!isNotFound(props.error))
    return (
      <ErrorFallback
        {...props}
        title={t('supply-partners.load-error-title')}
        description={t('supply-partners.load-error')}
        back={back}
      />
    );
  return (
    <Workspace>
      <SupplyPartnerHeading />
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t('supply-partners.not-found-title')}</EmptyTitle>
            <EmptyDescription>{t('supply-partners.not-found-description')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{back}</EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
