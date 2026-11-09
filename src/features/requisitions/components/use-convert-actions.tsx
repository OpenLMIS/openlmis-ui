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
import { beginCopy, retireCopy } from '@/features/requisitions/lib/offline-copies';
import type { ConvertListRow } from '@/features/requisitions/lib/types';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';
import { LocalDataUnavailableError, requireOnline } from '@/lib/local-data';
import { revealField } from '@/lib/reveal-field';
import { isSecureOrigin } from '@/lib/secure-context';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { settleFew } from '@/lib/settle-few';

type Problem =
  | { kind: 'depot' }
  | { kind: 'server'; message?: string }
  | { kind: 'uncertain' }
  | { kind: 'release-unknown' }
  | { kind: 'retry'; count: number };
export function useConvertActions(search: ConvertSearch, cards: boolean) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [picked, setPicked] = useState<ConvertSelection>(new Map());
  const [depots, setDepots] = useState<DepotMap>({});
  const [hasRows, setHasRows] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [unresolved, setUnresolved] = useState<ReadonlySet<string>>(new Set());
  const filter = JSON.stringify([search.programId, search.facilityId]);
  const [problem, setProblem] = useFilterScoped<Problem | null>(filter, null);
  const [confirmation, setConfirmation] = useFilterScoped<boolean | null>(filter, null);
  const listRef = useRef<HTMLElement>(null);
  const confirmationKind = useRef(true);
  if (confirmation !== null) confirmationKind.current = confirmation;
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
      client.invalidateQueries({ queryKey: [...queryKeys.orders.all, 'list'] }),
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
      const scope = getSessionScope();
      await releaseRequisitions(body);
      assertSessionScope(scope);
      if (isSecureOrigin) {
        for (const { requisitionId } of body.requisitionsToRelease) {
          try {
            const lease = await beginCopy(requisitionId);
            assertSessionScope(scope);
            await retireCopy(lease);
            assertSessionScope(scope);
          } catch (error) {
            assertSessionScope(scope);
            if (!(error instanceof LocalDataUnavailableError))
              toast.error(t('requisitions.offline.failed-title'), {
                description: t('requisitions.offline.failed-description'),
              });
          }
        }
      }
    },
    onSuccess: async (_, body) => {
      const ids = body.requisitionsToRelease.map(({ requisitionId }) => requisitionId);
      setPicked((previous) => withoutIds(previous, ids));
      setUnresolved((previous) => new Set([...previous].filter((id) => !ids.includes(id))));
      setInvalid(false);
      notifySuccess(body);
      focusList();
      await refresh();
      if (!mutation.isCurrent()) return;
      focusList();
    },
    onError: async (error, body) => {
      if (error instanceof LocalDataUnavailableError) {
        setProblem({ kind: 'server', message: t('requisitions.convert.offline') }, filter);
        return;
      }
      if (uncertainRelease(error)) {
        const ids = body.requisitionsToRelease.map(({ requisitionId }) => requisitionId);
        setPicked(new Map());
        setInvalid(false);
        setUnresolved((previous) => new Set([...previous, ...ids]));
        setProblem({ kind: body.createOrder ? 'uncertain' : 'release-unknown' }, filter);
        focusList();
        await refresh();
        if (!mutation.isCurrent()) return;
        const results = await settleFew(ids, async (id) => {
          const record = await fetchRequisition(id);
          return {
            id,
            done: record.status === 'RELEASED' || record.status === 'RELEASED_WITHOUT_ORDER',
          };
        });
        if (!mutation.isCurrent()) return;
        const done = new Set(results.done.filter((result) => result.done).map(({ id }) => id));
        setUnresolved((previous) => new Set([...previous].filter((id) => !done.has(id))));
      } else {
        let message = serverMessage(error);
        for (const [id, row] of picked) message = message?.replaceAll(id, row.label);
        setPicked(new Map());
        setProblem({ kind: 'server', message }, filter);
        focusList();
        await refresh();
      }
    },
    onSettled: () => {
      sending.current = false;
    },
  });
  const request = (createOrder: boolean) => {
    if (sending.current || mutation.isPending) return;
    const error = convertSelectionError(picked, depots);
    if (error === 'none') return;
    else if (error === 'depot') {
      setInvalid(true);
      setProblem({ kind: 'depot' }, filter);
    } else if (createOrder && [...picked.keys()].some((id) => unresolved.has(id)))
      setProblem(
        { kind: 'retry', count: [...picked.keys()].filter((id) => unresolved.has(id)).length },
        filter,
      );
    else setConfirmation(createOrder, filter);
  };
  const submit = () => {
    if (sending.current || confirmation === null) return;
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
  const actionButton = (createOrder: boolean) => (
    <Button
      size="lg"
      variant={createOrder ? 'default' : 'outline'}
      disabled={mutation.isPending}
      onClick={() => request(createOrder)}
    >
      <SelectionBarLabel
        full={t(createOrder ? 'requisitions.convert.convert' : 'requisitions.convert.release')}
        short={t(
          createOrder ? 'requisitions.convert.convert-short' : 'requisitions.convert.release-short',
        )}
      />
    </Button>
  );
  const controls = (
    <DataTableSelectionBar
      placement="footer"
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
          {actionButton(false)}
          {actionButton(true)}
        </>
      )}
    </DataTableSelectionBar>
  );
  const messages = {
    depot: {
      title: t('requisitions.convert.no-depot'),
      description: t('requisitions.convert.no-depot-description'),
    },
    'release-unknown': {
      title: t('requisitions.convert.release-unknown'),
      description: t('requisitions.convert.release-unknown-description'),
    },
    uncertain: {
      title: t('requisitions.convert.uncertain'),
      description: t('requisitions.convert.uncertain-description'),
    },
    retry: {
      title: t('requisitions.convert.uncertain'),
      description: t('requisitions.convert.retry-confirm', {
        count: problem?.kind === 'retry' ? problem.count : 0,
      }),
    },
    server: {
      title: t('requisitions.convert.failed'),
      description:
        problem?.kind === 'server' && problem.message
          ? problem.message
          : t('requisitions.convert.failed-description'),
    },
  };
  const { title, description } = messages[problem?.kind ?? 'server'];
  const dialogs = (
    <>
      <InvalidSubmitDialog
        open={problem !== null}
        finalFocus={invalidTarget.current ? false : () => listRef.current ?? true}
        onOpenChangeComplete={(open) => {
          if (open) return;
          if (invalidTarget.current) revealField(invalidTarget.current, cards);
          else focusList();
          invalidTarget.current = null;
        }}
        title={title}
        description={description}
        closeLabel={t('dialog.close')}
        onOpenChange={closeProblem}
      >
        {problem?.kind === 'retry' ? (
          <>
            <AlertDialogCancel>{t('dialog.close')}</AlertDialogCancel>
            <Button
              variant="warning"
              onClick={() => {
                setProblem(null, filter);
                setConfirmation(true, filter);
              }}
            >
              {t('requisitions.convert.confirm')}
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
              {t(
                confirmationKind.current
                  ? 'requisitions.convert.convert'
                  : 'requisitions.convert.release',
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                confirmationKind.current
                  ? 'requisitions.convert.convert-confirm'
                  : 'requisitions.convert.release-confirm',
                { count: picked.size },
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
