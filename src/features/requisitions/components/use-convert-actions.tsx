import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DataTableSelectionBar,
  SelectionBarLabel,
} from '@/components/data-table/data-table-selection';
import { serverMessage } from '@/components/display/dialog-parts';
import { InvalidSubmitDialog } from '@/components/display/invalid-submit-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useFilterScoped, withoutIds } from '@/components/valid-assignments/selection';
import { fetchRequisition, releaseRequisitions } from '@/features/requisitions/api/api';
import {
  type ConvertSearch,
  type ConvertSelection,
  convertSelectionError,
  type DepotMap,
  type ReleaseBody,
  releaseBody,
  seedDepots,
  uncertainRelease,
} from '@/features/requisitions/lib/convert-search';
import type { ConvertListRow } from '@/features/requisitions/lib/types';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';
import { LocalDataUnavailableError, requireOnline } from '@/lib/local-data';
import { revealField } from '@/lib/reveal-field';
import { settleFew } from '@/lib/settle-few';

type Problem =
  | { kind: 'none'; createOrder: boolean }
  | { kind: 'depot' }
  | { kind: 'server'; message?: string }
  | { kind: 'uncertain' }
  | { kind: 'release-unknown' };
export function useConvertActions(search: ConvertSearch, cards: boolean) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [picked, setPicked] = useState<ConvertSelection>(new Map());
  const [depots, setDepots] = useState<DepotMap>({});
  const [hasRows, setHasRows] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [blocked, setBlocked] = useState<ReadonlySet<string>>(new Set());
  const filter = JSON.stringify([search.programId, search.facilityId]);
  const [problem, setProblem] = useFilterScoped<Problem | null>(filter, null);
  const [confirmation, setConfirmation] = useFilterScoped<boolean | null>(filter, null);
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const listRef = useRef<HTMLDivElement>(null);
  const sending = useRef(false);
  const invalidTarget = useRef<HTMLElement | null>(null);
  const onRows = useCallback((rows: ConvertListRow[]) => {
    setHasRows(rows.length > 0);
    setDepots((previous) => seedDepots(previous, rows));
  }, []);
  const onDepot = useCallback(
    (id: string, depot: string) => setDepots((previous) => ({ ...previous, [id]: depot })),
    [],
  );
  const focusList = () => requestAnimationFrame(() => listRef.current?.focus());
  const refresh = async () => {
    await Promise.allSettled([
      client.invalidateQueries({ queryKey: queryKeys.requisitions.all }),
      client.invalidateQueries({ queryKey: queryKeys.home.all }),
    ]);
  };
  const notifySuccess = (body: ReleaseBody) => {
    toast.success(
      t(
        body.createOrder
          ? 'requisitions.convert.convert-success'
          : 'requisitions.convert.release-success',
      ),
      {
        description: t(
          body.createOrder
            ? 'requisitions.convert.convert-success-description'
            : 'requisitions.convert.release-success-description',
        ),
      },
    );
  };
  const mutation = useSessionMutation({
    mutationFn: async (body: ReleaseBody) => {
      requireOnline();
      await releaseRequisitions(body);
    },
    onSuccess: async (_, body) => {
      const ids = body.requisitionsToRelease.map(({ requisitionId }) => requisitionId);
      setPicked((previous) => withoutIds(previous, ids));
      setBlocked((previous) => new Set([...previous].filter((id) => !ids.includes(id))));
      setInvalid(false);
      notifySuccess(body);
      await refresh();
      if (!mutation.isCurrent()) return;
      focusList();
    },
    onError: async (error, body) => {
      if (error instanceof LocalDataUnavailableError) {
        setProblem(
          { kind: 'server', message: t('requisitions.convert.offline') },
          filterRef.current,
        );
        return;
      }
      if (uncertainRelease(error)) {
        const results = await settleFew(body.requisitionsToRelease, async ({ requisitionId }) => {
          const record = await fetchRequisition(requisitionId);
          return {
            id: requisitionId,
            done: record.status === 'RELEASED' || record.status === 'RELEASED_WITHOUT_ORDER',
          };
        });
        if (!mutation.isCurrent()) return;
        const done = results.done.filter((result) => result.done).map(({ id }) => id);
        const unresolved = [
          ...results.done.filter((result) => !result.done).map(({ id }) => id),
          ...results.failed.map(({ requisitionId }) => requisitionId),
        ];
        setPicked((previous) => withoutIds(previous, done));
        if (body.createOrder && unresolved.length) {
          setBlocked((previous) => new Set([...previous, ...unresolved]));
          setProblem({ kind: 'uncertain' }, filterRef.current);
        } else if (results.failed.length)
          setProblem({ kind: 'release-unknown' }, filterRef.current);
        else if (unresolved.length)
          setProblem({ kind: 'server', message: serverMessage(error) }, filterRef.current);
        else {
          setInvalid(false);
          notifySuccess(body);
          focusList();
        }
      } else setProblem({ kind: 'server', message: serverMessage(error) }, filterRef.current);
      await refresh();
      if (!mutation.isCurrent()) return;
    },
    onSettled: () => {
      sending.current = false;
    },
  });
  const request = (createOrder: boolean) => {
    if (sending.current || mutation.isPending) return;
    const error = convertSelectionError(picked, depots);
    if (error === 'none') setProblem({ kind: 'none', createOrder }, filter);
    else if (error === 'depot') {
      setInvalid(true);
      setProblem({ kind: 'depot' }, filter);
    } else if (createOrder && [...picked.keys()].some((id) => blocked.has(id)))
      setProblem({ kind: 'uncertain' }, filter);
    else setConfirmation(createOrder, filter);
  };
  const submit = () => {
    if (sending.current || confirmation === null) return;
    try {
      requireOnline();
    } catch {
      setConfirmation(null, filter);
      setProblem({ kind: 'server', message: t('requisitions.convert.offline') }, filter);
      return;
    }
    const error = convertSelectionError(picked, depots);
    if (error) {
      setConfirmation(null, filter);
      request(confirmation);
      return;
    }
    sending.current = true;
    const body = releaseBody(confirmation, picked, depots);
    setConfirmation(null, filter);
    mutation.mutate(body);
  };
  const closeProblem = (open: boolean) => {
    if (open) return;
    if (problem?.kind === 'depot')
      invalidTarget.current =
        listRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? null;
    setProblem(null, filter);
  };
  const actionButton = (createOrder: boolean, selection: boolean) => (
    <Button
      size={selection ? 'sm' : 'lg'}
      variant={createOrder ? 'default' : 'outline'}
      disabled={mutation.isPending}
      onClick={() => request(createOrder)}
    >
      {selection ? (
        <SelectionBarLabel
          full={t(createOrder ? 'requisitions.convert.convert' : 'requisitions.convert.release')}
          short={t(
            createOrder
              ? 'requisitions.convert.convert-short'
              : 'requisitions.convert.release-short',
          )}
        />
      ) : (
        t(createOrder ? 'requisitions.convert.convert' : 'requisitions.convert.release')
      )}
    </Button>
  );
  const controls = (
    <>
      {hasRows && !picked.size && (
        <div className="flex flex-wrap justify-between gap-2">
          {actionButton(false, false)}
          {actionButton(true, false)}
        </div>
      )}
      <DataTableSelectionBar
        count={picked.size}
        onClear={() => {
          if (!sending.current) {
            setPicked(new Map());
            setInvalid(false);
            focusList();
          }
        }}
      >
        {hasRows && (
          <>
            {actionButton(false, true)}
            {actionButton(true, true)}
          </>
        )}
      </DataTableSelectionBar>
    </>
  );
  const title =
    problem?.kind === 'depot'
      ? t('requisitions.convert.no-depot')
      : problem?.kind === 'none'
        ? t('requisitions.convert.select-none')
        : problem?.kind === 'release-unknown'
          ? t('requisitions.convert.release-unknown')
          : problem?.kind === 'uncertain'
            ? t('requisitions.convert.uncertain')
            : t('requisitions.convert.failed');
  const description =
    problem?.kind === 'depot'
      ? t('requisitions.convert.no-depot-description')
      : problem?.kind === 'none'
        ? t(
            problem.createOrder
              ? 'requisitions.convert.select-none-convert'
              : 'requisitions.convert.select-none-release',
          )
        : problem?.kind === 'release-unknown'
          ? t('requisitions.convert.release-unknown-description')
          : problem?.kind === 'uncertain'
            ? t('requisitions.convert.uncertain-description')
            : problem?.kind === 'server' && problem.message
              ? problem.message
              : t('requisitions.convert.failed-description');
  const dialogs = (
    <>
      <InvalidSubmitDialog
        open={problem !== null}
        finalFocus={invalidTarget.current ? false : undefined}
        onOpenChangeComplete={(open) => {
          if (open || !invalidTarget.current) return;
          revealField(invalidTarget.current, cards);
          invalidTarget.current = null;
        }}
        title={title}
        description={description}
        closeLabel={t('dialog.close')}
        onOpenChange={closeProblem}
      >
        {problem?.kind === 'uncertain' ? (
          <>
            <AlertDialogCancel>{t('dialog.close')}</AlertDialogCancel>
            <Button
              variant="warning"
              onClick={() => {
                setProblem(null, filter);
                setConfirmation(true, filter);
              }}
            >
              {t('requisitions.convert.convert-again')}
            </Button>
          </>
        ) : undefined}
      </InvalidSubmitDialog>
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null, filter);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(confirmation ? 'requisitions.convert.convert' : 'requisitions.convert.release')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                confirmation
                  ? 'requisitions.convert.convert-confirm'
                  : 'requisitions.convert.release-confirm',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={submit}>
              {t('requisitions.convert.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
  return {
    pending: mutation.isPending,
    table: {
      picked,
      onSelection: (next: ConvertSelection) => {
        setPicked(next);
        if (convertSelectionError(next, depots) !== 'depot') setInvalid(false);
      },
      depots,
      onDepot,
      onRows,
      invalid,
      pending: mutation.isPending,
      listRef,
    },
    controls,
    dialogs,
  };
}
