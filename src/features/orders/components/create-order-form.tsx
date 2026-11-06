import { useQuery } from '@tanstack/react-query';
import { type ColumnDef, useTable } from '@tanstack/react-table';
import { Building2Icon, Trash2Icon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { CardActions } from '@/components/display/card-actions';
import { serverMessage } from '@/components/display/dialog-parts';
import { TableCards } from '@/components/display/table-cards';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { createOrder } from '@/features/orders/api/api';
import { supplyingFacilitiesOptions } from '@/features/orders/api/queries';
import { OrderSelect } from '@/features/orders/components/order-select';
import { useRemovalFocus } from '@/features/orders/hooks/use-removal-focus';
import { userProgramsOptions } from '@/features/reference-data/api/queries';
import type { MinimalFacility, Program } from '@/features/reference-data/lib/types';
import { useCardLayout } from '@/hooks/use-card-view';
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
  const picker = useRef<HTMLDivElement>(null);
  const [ids, setIds] = useState<string[]>([]);
  const selectedFacilities = useMemo(
    () => facilities.filter((facility) => ids.includes(facility.id)),
    [facilities, ids],
  );
  const requestingOptions = useMemo(
    () => requesting.filter((facility) => !ids.includes(facility.id)),
    [requesting, ids],
  );
  const focus = useRemovalFocus(
    selectedFacilities.map((facility) => facility.id),
    () => picker.current?.querySelector<HTMLElement>('[role=combobox]') ?? null,
  );
  const [pickerVersion, setPickerVersion] = useState(0);
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
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const removeRef = useRef<(id: string) => void>(() => undefined);
  removeRef.current = (id) => {
    focus.removing(id);
    setIds((current) => current.filter((value) => value !== id));
    setSupplier('');
  };
  const columns = useMemo<ColumnDef<DataTableFeatures, MinimalFacility>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: t('orders.create.facility'),
        meta: { label: t('orders.create.facility') },
      },
      {
        id: 'actions',
        header: t('orders.edit.actions'),
        cell: ({ row }) => {
          const label = t('orders.create.remove-facility', { facility: row.original.name });
          const remove = () => removeRef.current(row.original.id);
          return cards ? (
            <div data-removal-control>
              <CardActions
                label={t('orders.edit.actions')}
                actions={[
                  {
                    id: 'remove',
                    icon: <Trash2Icon />,
                    label,
                    destructive: true,
                    disabled: mutation.isPending,
                    onSelect: remove,
                  },
                ]}
              />
            </div>
          ) : (
            <Button
              data-removal-control
              variant="ghost"
              size="icon-sm"
              aria-label={label}
              disabled={mutation.isPending}
              onClick={remove}
            >
              <Trash2Icon />
            </Button>
          );
        },
      },
    ],
    [t, cards, mutation.isPending],
  );
  const table = useTable({
    features: dataTableFeatures,
    data: selectedFacilities,
    columns,
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
      <div ref={picker}>
        <OrderSelect
          key={pickerVersion}
          required
          label={t('orders.create.requesting-facility')}
          placeholder={t('orders.create.select-requesting-facility')}
          options={requestingOptions}
          value=""
          disabled={mutation.isPending || facilitiesPending}
          onChange={(id) => {
            if (!id) return;
            setIds((current) => (current.includes(id) ? current : [...current, id]));
            setSupplier('');
            setPickerVersion((version) => version + 1);
            requestAnimationFrame(() =>
              picker.current?.querySelector<HTMLElement>('[role=combobox]')?.focus(),
            );
          }}
        />
      </div>
      <Separator />
      <div
        ref={(element) => {
          measure(element);
          focus.region.current = element;
        }}
      >
        {cards ? (
          <TableCards
            table={table}
            title="name"
            empty={<DataTableEmpty icon={<Building2Icon />} title={t('orders.create.empty')} />}
          />
        ) : (
          <DataTable table={table} empty={t('orders.create.empty')} />
        )}
      </div>
      <div className="min-w-0">
        <OrderSelect
          required
          label={t('orders.create.supplying-facility')}
          placeholder={t('orders.create.select-supplying-facility')}
          options={options}
          value={supplierId}
          disabled={!programId || !ids.length || suppliers.isFetching || mutation.isPending}
          onChange={setSupplier}
        />
      </div>
      {suppliers.isFetching && (
        <div role="status" className="flex items-center gap-2 text-muted-foreground text-sm">
          <Spinner />
          {t('supply-lines.facilities-loading')}
        </div>
      )}
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
