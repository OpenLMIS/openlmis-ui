import { useStore } from '@tanstack/react-form';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
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
import type { Product } from '@/features/products/lib/types';
import { ORDERABLE_SEARCH_SIZE } from '@/features/reference-data/api/api';
import { orderablesSearchOptions } from '@/features/reference-data/api/queries';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { isOfflineError } from '@/lib/http';

const SEARCH_DELAY = 300;

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
  const [seen, setSeen] = useState<ReadonlyMap<string, Product>>(new Map());
  const form = useAppForm({
    defaultValues: { picked: [] as string[], code: '' },
    onSubmit: ({ value }) => {
      onAdd(value.picked.flatMap((id) => seen.get(id) ?? []));
      onDone();
    },
  });
  const typedCode = useStore(form.store, (state) => state.values.code);
  const query = useDebouncedValue(typed.trim(), SEARCH_DELAY);
  const code = useDebouncedValue(typedCode.trim(), SEARCH_DELAY);

  const results = useQuery({
    ...orderablesSearchOptions({ name: query, code }),
    placeholderData: keepPreviousData,
  });
  const found = results.data?.content;
  const searching = typed.trim() !== query || typedCode.trim() !== code || results.isFetching;

  useEffect(() => {
    if (!found) return;
    setSeen((previous) => new Map([...previous, ...found.map((item) => [item.id, item] as const)]));
  }, [found]);

  const items = useMemo(
    () =>
      (found ?? [])
        .filter((product) => !excluded.has(product.id))
        .map((product) => ({ value: product.id, label: productLabel(product) })),
    [found, excluded],
  );

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('products.kit.add-title')}</FormDialogTitle>
        <FormDialogDescription>{t('products.kit.add-description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {/* Enter searches the code, as the box does as you type; only Add closes the dialog. */}
          <fieldset
            className="contents"
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault();
            }}
          >
            <form.AppField name="code">
              {(field) => (
                <field.TextField
                  autoComplete="off"
                  description={
                    code && !searching && results.data
                      ? t('products.kit.code-matches', { count: results.data.totalElements })
                      : undefined
                  }
                  label={t('products.kit.code')}
                  placeholder={t('products.search-code')}
                />
              )}
            </form.AppField>
          </fieldset>
          <form.AppField name="picked">
            {(field) => (
              <field.MultiComboboxField
                description={
                  !searching && (results.data?.totalElements ?? 0) > ORDERABLE_SEARCH_SIZE
                    ? t('products.kit.search-more', {
                        shown: items.length,
                        count: results.data?.totalElements,
                      })
                    : t('products.kit.search-description')
                }
                emptyMessage={
                  searching
                    ? t('products.kit.searching')
                    : results.isError
                      ? t(
                          isOfflineError(results.error)
                            ? 'offline.notice-title'
                            : 'products.kit.search-error',
                        )
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
