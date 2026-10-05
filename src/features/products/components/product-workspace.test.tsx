import { screen } from '@testing-library/react';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { ProductWorkspace } from '@/features/products/components/product-workspace';
import type { ProductDetail } from '@/features/products/lib/types';
import { renderPage } from '@/tests/render-page';

beforeAll(async () => {
  await i18n
    .use(ICU)
    .use(initReactI18next)
    .init({
      lng: 'en',
      keySeparator: false,
      nsSeparator: false,
      resources: {
        en: { translation: { 'products.edit.title': 'products.edit.title {product}' } },
      },
    });
});

const product: ProductDetail = {
  id: 'o1',
  productCode: 'C100',
  fullProductName: 'Levora',
  description: null,
  netContent: 1,
  packRoundingThreshold: 0,
  roundToZero: false,
  dispensable: { dispensingUnit: 'each' },
  programs: [],
};

function renderWorkspace(shown: ProductDetail) {
  renderPage(
    <ProductWorkspace product={shown} productId="o1">
      content
    </ProductWorkspace>,
    { path: '/administration/products/o1/general' },
  );
}

describe('ProductWorkspace', () => {
  it('names the product being edited in the title', async () => {
    renderWorkspace(product);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'products.edit.title Levora' }),
    ).toBeInTheDocument();
  });

  it('names the product by its code when it has no name', async () => {
    renderWorkspace({ ...product, fullProductName: null });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'products.edit.title C100' }),
    ).toBeInTheDocument();
  });

  it('offers General, Programs, Facility Types and Kit Unpack List, in that order', async () => {
    renderWorkspace(product);

    await screen.findByRole('tablist', { name: 'products.edit.tabs-label' });
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'products.edit.tabs.general',
      'products.edit.tabs.programs',
      'products.edit.tabs.facility-types',
      'products.edit.tabs.kit-unpack-list',
    ]);
    expect(screen.getByRole('tab', { name: 'products.edit.tabs.kit-unpack-list' })).toHaveAttribute(
      'href',
      '/administration/products/o1/kit-unpack-list',
    );
  });
});
