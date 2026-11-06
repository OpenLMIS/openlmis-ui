import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { useQuery } from '@tanstack/react-query';
import { Building2Icon } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { serverMessage } from '@/components/display/dialog-parts';
import { FieldLabelText } from '@/components/form/form-fields';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  ComboboxVirtualList,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { createOrder } from '@/features/orders/api/api';
import { supplyingFacilitiesOptions } from '@/features/orders/api/queries';
import { OrderSelect } from '@/features/orders/components/order-select';
import { userProgramsOptions } from '@/features/reference-data/api/queries';
import type { MinimalFacility, Program } from '@/features/reference-data/lib/types';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { settleFew } from '@/lib/settle-few';

const EMPTY_PROGRAMS: Program[] = [];

export function CreateOrderForm({
  userId,
  facilitiesPending = false,
  facilities,
  requesting,
  canRead,
  onCreated,
}: {
  userId: string;
  facilitiesPending?: boolean;
  facilities: MinimalFacility[];
  requesting: MinimalFacility[];
  canRead: (program: string, supplier: string, ids: string[]) => boolean;
  onCreated: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const { data: programs = EMPTY_PROGRAMS, isPending: programsPending } = useQuery({
    ...userProgramsOptions(userId),
    throwOnError: true,
  });
  const programOptions = useMemo(
    () => programs.map((p) => ({ id: p.id, name: p.name ?? p.code })),
    [programs],
  );
  const [pickedProgram, setProgram] = useState('');
  const programId = pickedProgram || (programs.length === 1 ? programs[0].id : '');
  const requestingId = useId();
  const anchor = useComboboxAnchor();
  const { contains } = ComboboxPrimitive.useFilter();
  const [ids, setIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const selectedFacilities = useMemo(
    () => facilities.filter((facility) => ids.includes(facility.id)),
    [facilities, ids],
  );
  const [supplier, setSupplier] = useState('');
  const suppliers = useQuery({
    ...supplyingFacilitiesOptions(programId, ids),
    enabled: !!programId && ids.length > 0,
  });
  const options = facilities
    .filter((f) => suppliers.data?.includes(f.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const supplierId = options.some((f) => f.id === supplier)
    ? supplier
    : options.length === 1
      ? options[0].id
      : '';
  const ready = !!programId && ids.length > 0 && !!supplierId;
  const readable = ready && canRead(programId, supplierId, ids);
  const mutation = useSessionMutation({
    mutationFn: () =>
      settleFew(ids, async (id) => ({
        id,
        order: await createOrder({
          emergency: true,
          createdBy: { id: userId },
          program: { id: programId },
          requestingFacility: { id },
          receivingFacility: { id },
          supplyingFacility: { id: supplierId },
          facility: { id },
        }),
      })),
    onSuccess: (result) => {
      const reason = serverMessage(result.error) ?? t('error.description');
      if (result.failed.length) {
        const names = result.failed
          .map((id) => facilities.find((f) => f.id === id)?.name ?? id)
          .join(', ');
        if (result.done.length)
          toast.warning(t('orders.create.created-partly-title'), {
            description: t('orders.create.created-partly-description', {
              facilities: names,
              reason,
            }),
          });
        else
          toast.error(t('orders.create.create-failed-title'), {
            description: t('orders.create.create-failed-description', { reason }),
          });
      }
      if (result.done.length) onCreated(result.done.map((item) => item.order.id));
    },
    onError: (error) =>
      toast.error(t('orders.create.create-failed-title'), {
        description: t('orders.create.create-failed-description', {
          reason: serverMessage(error) ?? t('error.description'),
        }),
      }),
  });
  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
      <FieldGroup>
        <div className="min-w-0">
          <OrderSelect
            required
            label={t('orders.create.program')}
            placeholder={t('orders.create.select-program')}
            options={programOptions}
            value={programId}
            disabled={mutation.isPending || programsPending}
            onChange={(id) => {
              setProgram(id);
              setSupplier('');
            }}
          />
        </div>
      </FieldGroup>
      <Field data-disabled={mutation.isPending || facilitiesPending}>
        <FieldLabel htmlFor={requestingId}>
          <FieldLabelText label={t('orders.create.requesting-facility')} required />
        </FieldLabel>
        <Combobox
          multiple
          items={requesting}
          limit={-1}
          virtualized={requesting.length > 50}
          value={selectedFacilities}
          inputValue={search}
          onInputValueChange={setSearch}
          disabled={mutation.isPending || facilitiesPending}
          filter={(item, query) => contains(item.name, query) || contains(item.code ?? '', query)}
          itemToStringLabel={(item) => item.name}
          isItemEqualToValue={(a, b) => a.id === b.id}
          onOpenChange={(open, details) => {
            if (!open && details.reason === 'item-press') details.cancel();
          }}
          onValueChange={(chosen, details) => {
            if (details.reason === 'escape-key' && !chosen.length)
              return details.allowPropagation();
            setSearch('');
            setIds(chosen.map((item) => item.id));
            setSupplier('');
          }}
        >
          <ComboboxChips ref={anchor} size="lg">
            <Building2Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <ComboboxValue>
              {(values: MinimalFacility[]) => (
                <>
                  {values.map((item) => (
                    <ComboboxChip
                      key={item.id}
                      removeLabel={t('orders.create.remove-facility', { facility: item.name })}
                    >
                      <span className="truncate" dir="auto">
                        {item.name}
                      </span>
                    </ComboboxChip>
                  ))}
                  <ComboboxChipsInput
                    id={requestingId}
                    aria-label={t('orders.create.requesting-facility')}
                    aria-required
                    disabled={mutation.isPending || facilitiesPending}
                    placeholder={
                      values.length ? undefined : t('orders.create.select-requesting-facility')
                    }
                  />
                </>
              )}
            </ComboboxValue>
          </ComboboxChips>
          <ComboboxContent anchor={anchor}>
            <ComboboxEmpty>{t('orders.no-options')}</ComboboxEmpty>
            {requesting.length > 50 ? (
              <ComboboxVirtualList<MinimalFacility> itemKey={(item) => item.id}>
                {(item) => (
                  <span className="min-w-0 whitespace-normal break-words" dir="auto">
                    {item.name}
                  </span>
                )}
              </ComboboxVirtualList>
            ) : (
              <ComboboxList>
                {(item: MinimalFacility) => (
                  <ComboboxItem key={item.id} value={item}>
                    <span dir="auto">{item.name}</span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            )}
          </ComboboxContent>
        </Combobox>
      </Field>
      <div className="min-w-0">
        <OrderSelect
          required
          label={t('orders.create.supplying-facility')}
          placeholder={t('orders.create.select-supplying-facility')}
          options={options}
          value={supplierId}
          disabled={!programId || !ids.length || mutation.isPending}
          loading={suppliers.isFetching ? t('supply-lines.facilities-loading') : undefined}
          onChange={setSupplier}
        />
      </div>
      {suppliers.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {serverMessage(suppliers.error) ?? t('error.description')}{' '}
            <Button variant="outline" onClick={() => suppliers.refetch()}>
              {t('error.try-again')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {!!programId && ids.length > 0 && suppliers.isSuccess && !options.length && (
        <Alert>
          <AlertDescription>{t('orders.create.no-supplier')}</AlertDescription>
        </Alert>
      )}
      {ready && !readable && (
        <Alert>
          <AlertDescription>{t('orders.create.no-read-right')}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end">
        <Button
          type="button"
          size="lg"
          disabled={!readable || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {t('orders.create.create')}
        </Button>
      </div>
    </form>
  );
}
