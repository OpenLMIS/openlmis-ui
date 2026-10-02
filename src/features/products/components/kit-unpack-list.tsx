import { revalidateLogic, useStore } from '@tanstack/react-form';
import { BoxesIcon, Loader2Icon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DataTableCard,
  DataTableEmpty,
  DataTableToolbar,
} from '@/components/data-table/data-table';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { Block } from '@/components/skeleton-block';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WorkspaceFooterPortal } from '@/components/workspace-tabs';
import { KitProductsDialog } from '@/features/products/components/kit-products-dialog';
import { useProductSave } from '@/features/products/hooks/use-product-save';
import {
  hasKitChanges,
  kitFormSchema,
  toKitBody,
  toKitFormValues,
  toKitRow,
} from '@/features/products/lib/kit-form';
import { productName } from '@/features/products/lib/product-name';
import type { Product, ProductDetail } from '@/features/products/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';

const FORM_ID = 'kit-unpack-list-form';

type KitUnpackListProps = {
  kit: ProductDetail;
  products: readonly Product[];
  readOnly: boolean;
  adding: boolean;
  onAddOpen: () => void;
  onAddClose: () => void;
  onDone: () => void;
};

export function KitUnpackList({
  kit,
  products,
  readOnly,
  adding,
  onAddOpen,
  onAddClose,
  onDone,
}: KitUnpackListProps) {
  const { t } = useTranslation();
  const save = useProductSave(kit.id);
  const leaving = useRef(false);
  const listRegion = useRef<HTMLElement>(null);
  const kitLabel = productName(kit);

  const form = useAppForm({
    defaultValues: toKitFormValues(kit, products),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: kitFormSchema() },
    onSubmit: ({ value }) =>
      save
        .mutateAsync((latest) => toKitBody(value, latest), {
          onSuccess: (saved) => {
            toast.success(t('products.kit.saved-title'), {
              description: t('products.kit.saved', { product: kitLabel }),
            });
            if (hasKitChanges(form.state.values, saved)) return;
            leaving.current = true;
            if (!guard.leaveIfAsked()) onDone();
          },
        })
        .catch(() => undefined),
  });

  const changed = useStore(form.store, (state) => hasKitChanges(state.values, kit));
  const guard = useDiscardGuard(changed, { allowLeave: () => leaving.current });
  const rows = useStore(form.store, (state) => state.values.children);
  const excluded = useMemo(() => new Set([kit.id, ...rows.map((row) => row.id)]), [kit.id, rows]);

  const addProducts = (picked: Product[]) =>
    form.setFieldValue('children', (current) => [
      ...current,
      ...picked.map((product) => toKitRow(product)),
    ]);

  return (
    <>
      <form
        className="flex flex-col gap-4"
        id={FORM_ID}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (changed) void form.handleSubmit();
        }}
      >
        {!readOnly && (
          <DataTableToolbar>
            <div className="w-full @2xl/main:ms-auto @2xl/main:w-auto">
              <Button onClick={onAddOpen} type="button" width="full">
                <PlusIcon data-icon="inline-start" />
                {t('products.kit.add')}
              </Button>
            </div>
          </DataTableToolbar>
        )}
        {save.isError && (
          <ErrorAlert
            description={serverMessage(save.error) ?? t('products.form.save-error')}
            title={t('products.kit.save-error-title')}
          />
        )}
        <section
          aria-label={t('products.kit.products')}
          className="outline-none"
          ref={listRegion}
          tabIndex={-1}
        >
          <DataTableCard>
            {rows.length === 0 ? (
              <DataTableEmpty
                description={t(
                  readOnly ? 'products.kit.empty-read-only' : 'products.kit.empty-description',
                )}
                icon={<BoxesIcon />}
                title={t('products.kit.empty-title')}
              />
            ) : (
              <Table density="comfortable">
                <TableHeader surface="muted">
                  <TableRow>
                    <TableHead>{t('products.kit.product')}</TableHead>
                    <TableHead>{t('products.kit.quantity')}</TableHead>
                    {!readOnly && (
                      <TableHead>
                        <span className="sr-only">{t('products.actions')}</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => {
                    const name = row.name || row.code;
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <span className="flex flex-col whitespace-normal break-words">
                            <span className="font-medium" dir="auto">
                              {row.name || row.code}
                            </span>
                            {row.name && (
                              <span className="text-muted-foreground text-xs" dir="ltr">
                                {row.code}
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="w-20 @md/main:w-28">
                            <form.AppField name={`children[${index}].quantity`}>
                              {(field) => (
                                <field.NumberField
                                  disabled={readOnly}
                                  label={t('products.kit.quantity-of', { product: name })}
                                  layout="inline"
                                  required
                                />
                              )}
                            </form.AppField>
                          </div>
                        </TableCell>
                        {!readOnly && (
                          <TableCell>
                            <div className="flex justify-end">
                              <Button
                                aria-label={t('products.kit.remove', { product: name })}
                                onClick={() => {
                                  form.removeFieldValue('children', index);
                                  listRegion.current?.focus();
                                }}
                                size="icon-sm"
                                type="button"
                                variant="ghost"
                              >
                                <Trash2Icon />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </DataTableCard>
        </section>
      </form>
      <WorkspaceFooterPortal width="default">
        <Button disabled={save.isPending} onClick={onDone} size="lg" variant="outline">
          {t(readOnly ? 'products.edit.back' : 'products.edit.cancel')}
        </Button>
        {!readOnly && (
          <Button disabled={!changed || save.isPending} form={FORM_ID} size="lg" type="submit">
            {save.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {t('products.kit.save')}
          </Button>
        )}
      </WorkspaceFooterPortal>
      <KitProductsDialog
        excluded={excluded}
        onAdd={addProducts}
        onClose={onAddClose}
        open={adding && !readOnly}
      />
      <DiscardChangesDialog description={t('products.kit.discard-description')} {...guard.dialog} />
    </>
  );
}

export function KitUnpackListSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-4">
      <DataTableCard>
        <Table density="comfortable">
          <TableHeader surface="muted">
            <TableRow>
              <TableHead>{t('products.kit.product')}</TableHead>
              <TableHead>{t('products.kit.quantity')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[0, 1, 2].map((row) => (
              <TableRow key={row}>
                <TableCell>
                  <Block className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Block className="h-8 w-28" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
