import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTable } from '@tanstack/react-table';
import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DataTable, dataTableFeatures } from '@/components/data-table/data-table';
import { RowActions } from '@/components/display/card-actions';
import { serverMessage as getErrorMessage } from '@/components/display/dialog-parts';
import { TableCards } from '@/components/display/table-cards';
import { PickerAdd, PickerAddButton, PickerAddField } from '@/components/pickers/picker-add';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import {
  Workspace,
  WorkspaceActions,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { createOrder } from '@/features/orders/api/api';
import { supplyingFacilitiesOptions } from '@/features/orders/api/queries';
import { OrderSelect } from '@/features/orders/components/order-select';
import { userProgramsOptions } from '@/features/reference-data/api/queries';
import type { MinimalFacility } from '@/features/reference-data/lib/types';
import { useCardLayout } from '@/hooks/use-card-view';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { settleFew } from '@/lib/settle-few';

export function CreateOrderForm({
  userId,
  facilities,
  requesting,
  canRead,
  onCreated,
}: {
  userId: string;
  facilities: MinimalFacility[];
  requesting: MinimalFacility[];
  canRead: (program: string, supplier: string, ids: string[]) => boolean;
  onCreated: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const { data: programs } = useSuspenseQuery(userProgramsOptions(userId));
  const [pickedProgram, setProgram] = useState('');
  const programId = pickedProgram || (programs.length === 1 ? programs[0].id : '');
  const [ids, setIds] = useState<string[]>([]);
  const [picked, setPicked] = useState('');
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
      const reason = getErrorMessage(result.error);
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
          reason: getErrorMessage(error),
        }),
      }),
  });
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const table = useTable({
    features: dataTableFeatures,
    data: facilities.filter((f) => ids.includes(f.id)),
    columns: [
      {
        id: 'name',
        accessorKey: 'name',
        header: t('orders.create.facility'),
        meta: { label: t('orders.create.facility') },
        cell: ({ row }) => row.original.name,
      },
      {
        id: 'actions',
        header: t('orders.edit.actions'),
        cell: ({ row }) => (
          <RowActions
            label={t('orders.edit.actions')}
            actions={[
              {
                id: 'remove',
                icon: <Trash2Icon />,
                label: t('orders.create.remove-facility', { facility: row.original.name }),
                destructive: true,
                disabled: mutation.isPending,
                onSelect: () => {
                  setIds((current) => current.filter((id) => id !== row.original.id));
                  setSupplier('');
                },
              },
            ]}
          />
        ),
      },
    ],
  });
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>{t('orders.create.title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('orders.create.description')}</WorkspaceDescription>
        </WorkspaceHeading>
        <WorkspaceActions>
          <Button
            size="lg"
            disabled={!readable || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t('orders.create.create')}
          </Button>
        </WorkspaceActions>
      </WorkspaceHeader>
      <WorkspaceContent>
        <FieldGroup>
          <div className="min-w-0 @3xl/main:max-w-96">
            <OrderSelect
              label={t('orders.create.program')}
              placeholder={t('orders.create.select-program')}
              options={programs.map((p) => ({ id: p.id, name: p.name ?? p.code }))}
              value={programId}
              disabled={mutation.isPending}
              onChange={(id) => {
                setProgram(id);
                setSupplier('');
              }}
            />
          </div>
        </FieldGroup>
        <div className="flex flex-wrap items-end gap-2">
          <PickerAdd>
            <PickerAddField>
              <OrderSelect
                compact
                label={t('orders.create.requesting-facility')}
                placeholder={t('orders.create.select-requesting-facility')}
                options={requesting.filter((f) => !ids.includes(f.id))}
                value={picked}
                disabled={mutation.isPending}
                onChange={setPicked}
              />
            </PickerAddField>
            <PickerAddButton
              disabled={!picked || mutation.isPending}
              onClick={() => {
                setIds((current) => [...current, picked]);
                setPicked('');
                setSupplier('');
              }}
            >
              {t('facilities.form.add')}
            </PickerAddButton>
          </PickerAdd>
        </div>
        <Separator />
        <div ref={measure}>
          {cards ? (
            <TableCards table={table} title="name" empty={t('orders.create.empty')} />
          ) : (
            <DataTable table={table} empty={t('orders.create.empty')} />
          )}
        </div>
        <div className="min-w-0 @3xl/main:max-w-96">
          <OrderSelect
            label={t('orders.create.supplying-facility')}
            placeholder={t('orders.create.select-supplying-facility')}
            options={options}
            value={supplierId}
            disabled={!programId || !ids.length || suppliers.isFetching || mutation.isPending}
            onChange={setSupplier}
          />
        </div>
        {suppliers.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {getErrorMessage(suppliers.error)}{' '}
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
      </WorkspaceContent>
    </Workspace>
  );
}
