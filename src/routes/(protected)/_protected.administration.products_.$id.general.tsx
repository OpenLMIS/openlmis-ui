import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { productDetailOptions } from '@/features/products/api/queries';
import { useBackToProducts } from '@/features/products/components/back-to-products';
import { ProductGeneralForm } from '@/features/products/components/product-general-form';

const productRoute = getRouteApi('/(protected)/_protected/administration/products_/$id');

export const Route = createFileRoute(
  '/(protected)/_protected/administration/products_/$id/general',
)({
  staticData: { crumbKey: 'products.edit.crumb' },
  component: GeneralTab,
});

function GeneralTab() {
  const { id } = Route.useParams();
  const { canEditProduct } = productRoute.useLoaderData();
  const { data: product } = useSuspenseQuery(productDetailOptions(id));
  const backToProducts = useBackToProducts();

  return (
    // A different product starts a fresh form.
    <ProductGeneralForm
      key={id}
      onDone={backToProducts}
      product={product}
      readOnly={!canEditProduct}
    />
  );
}
