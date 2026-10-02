import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppForm } from '@/components/form/form';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { FieldGroup } from '@/components/ui/field';
import { productsListOptions } from '@/features/products/api/queries';
import type { Product } from '@/features/products/lib/types';

const SEARCH_DELAY = 300;
const SEARCH_SIZE = 20;

type KitProductsDialogProps = {
  open: boolean;
  excluded: ReadonlySet<string>;
  onAdd: (products: Product[]) => void;
  onClose: () => void;
};

export function KitProductsDialog({ open, excluded, onAdd, onClose }: KitProductsDialogProps) {
  const { shown, dialogProps } = useDialogTarget(open ? 'add' : undefined, onClose);

  return (
    <FormDialog {...dialogProps(false)}>
      {shown && <KitProductsForm excluded={excluded} onAdd={onAdd} onDone={onClose} />}
    </FormDialog>
  );
}

const productLabel = (product: Product) => {
  const name = product.fullProductName
    ? `${product.productCode} - ${product.fullProductName}`
    : product.productCode;
  const unit = product.dispensable?.displayUnit;
  return unit ? `${name} (${unit})` : name;
};

type KitProductsFormProps = Omit<KitProductsDialogProps, 'open' | 'onClose'> & {
  onDone: () => void;
};

function KitProductsForm({ excluded, onAdd, onDone }: KitProductsFormProps) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');
  const [seen, setSeen] = useState<ReadonlyMap<string, Product>>(new Map());

  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed.trim()), SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [typed]);

  const results = useQuery(
    productsListOptions({
      page: 0,
      size: SEARCH_SIZE,
      sort: 'fullProductName,asc',
      q: query || undefined,
    }),
  );
  const found = results.data?.content;
  const searching = typed.trim() !== query || results.isFetching;

  useEffect(() => {
    if (!found) return;
    setSeen((previous) => new Map([...previous, ...found.map((item) => [item.id, item] as const)]));
  }, [found]);

  const items = useMemo(
    () =>
      searching
        ? []
        : (found ?? [])
            .filter((product) => !excluded.has(product.id))
            .map((product) => ({ value: product.id, label: productLabel(product) })),
    [searching, found, excluded],
  );

  const form = useAppForm({
    defaultValues: { picked: [] as string[] },
    onSubmit: ({ value }) => {
      onAdd(value.picked.flatMap((id) => seen.get(id) ?? []));
      onDone();
    },
  });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('products.kit.add-title')}</FormDialogTitle>
        <FormDialogDescription>{t('products.kit.add-description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <form.AppField name="picked">
            {(field) => (
              <field.MultiComboboxField
                description={t('products.kit.search-description')}
                emptyMessage={
                  searching
                    ? t('products.kit.searching')
                    : results.isError
                      ? t('products.kit.search-error')
                      : t('products.kit.search-empty')
                }
                items={items}
                label={t('products.kit.products')}
                onSearch={setTyped}
                placeholder={t('products.kit.search-placeholder')}
                removeLabel={(label) => t('products.kit.unpick', { product: label })}
              />
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
        <form.Subscribe selector={(state) => state.values.picked.length}>
          {(count) => (
            <FormDialogSubmit disabled={count === 0}>
              {t('products.kit.add-picked', { count })}
            </FormDialogSubmit>
          )}
        </form.Subscribe>
      </FormDialogFooter>
    </FormDialogForm>
  );
}
