import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { LoadError } from '@/components/load-error';
import { QueryBoundary } from '@/components/query-boundary';
import { productDetailOptions, productsByIdsOptions } from '@/features/products/api/queries';
import {
  KitUnpackList,
  KitUnpackListSkeleton,
} from '@/features/products/components/kit-unpack-list';
import { useBackToProducts } from '@/features/products/hooks/back-to-products';
import type { ProductDetail } from '@/features/products/lib/types';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const productRoute = getRouteApi('/(protected)/_protected/administration/products_/$id');

const kitSearchSchema = z.object({
  dialog: z.enum(['add']).optional().catch(undefined),
});

type KitSearch = z.infer<typeof kitSearchSchema>;

const CLOSED_DIALOGS = { dialog: undefined } satisfies KitSearch;

const kitProductIds = (kit: ProductDetail) =>
  (kit.children ?? []).map((child) => child.orderable.id);

export const Route = createFileRoute(
  '/(protected)/_protected/administration/products_/$id/kit-unpack-list',
)({
  validateSearch: kitSearchSchema,
  staticData: { crumbKey: 'products.edit.crumb' },
  loader: ({ context: { queryClient }, params }) => {
    const kit = queryClient.getQueryData(productDetailOptions(params.id).queryKey);
    if (kit) queryClient.prefetchQuery(productsByIdsOptions(kitProductIds(kit)));
  },
  component: KitTab,
});

function KitTab() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { data: kit } = useSuspenseQuery(productDetailOptions(id));

  return (
    <QueryBoundary
      errorComponent={({ error, reset }) => (
        <LoadError
          description={t('products.kit.error-description')}
          error={error}
          reset={reset}
          title={t('products.kit.error-title')}
        />
      )}
      pendingFallback={<KitUnpackListSkeleton />}
      resetKey="kit"
    >
      <KitEditor key={id} kit={kit} />
    </QueryBoundary>
  );
}

function KitEditor({ kit }: { kit: ProductDetail }) {
  const { canEditProduct } = productRoute.useLoaderData();
  const adding = Route.useSearch({ select: (search) => search.dialog === 'add' });
  const [ids] = useState(() => kitProductIds(kit));
  const { data: products } = useSuspenseQuery(productsByIdsOptions(ids));
  const { openDialog, closeDialog } = useSearchNavigation<KitSearch>(CLOSED_DIALOGS);
  const backToProducts = useBackToProducts();

  return (
    <KitUnpackList
      adding={adding}
      kit={kit}
      onAddClose={closeDialog}
      onAddOpen={() => openDialog({ dialog: 'add' })}
      onDone={backToProducts}
      products={products}
      readOnly={!canEditProduct}
    />
  );
}
