import { useStore } from '@tanstack/react-form';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { Loader2Icon } from 'lucide-react';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { serverMessage } from '@/components/display/dialog-parts';
import { DiscardChangesDialog } from '@/components/display/discard-changes-dialog';
import { InvalidSubmitDialog } from '@/components/display/invalid-submit-dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Workspace, WorkspaceContent, WorkspaceFooter } from '@/components/workspace/workspace';
import {
  authorizeBuqForecast,
  BuqMovedError,
  type ForecastBody,
  saveBuqForecast,
  submitBuqForecast,
} from '@/features/buq/api/api';
import {
  buqForecastOptions,
  buqRemarksOptions,
  buqSourcesOfFundsOptions,
} from '@/features/buq/api/queries';
import { buqStatusBadge } from '@/features/buq/components/buq-status-badge';
import {
  type ForecastDetails,
  ForecastDetailsList,
} from '@/features/buq/components/forecast-details';
import { ForecastGrid } from '@/features/buq/components/forecast-grid';
import { FundingDialog } from '@/features/buq/components/funding-dialog';
import { RejectionDialog } from '@/features/buq/components/rejection-dialog';
import { usePeriodNames } from '@/features/buq/components/use-buq-periods';
import { useForecastForm } from '@/features/buq/components/use-forecast-form';
import {
  type ForecastDraft,
  forecastBody,
  forecastTotals,
  fundingComplete,
  initialDraft,
  type LineDraft,
  lineValid,
  numberError,
  numbersValid,
  type ProductInfo,
  productInfo,
  sortModels,
} from '@/features/buq/lib/forecast';
import {
  canViewRejection,
  type ForecastAction,
  type ForecastRights,
  forecastActions,
} from '@/features/buq/lib/forecast-actions';
import { formatMoney } from '@/features/buq/lib/money';
import { regionOf } from '@/features/buq/lib/region';
import type { ForecastSearch } from '@/features/buq/lib/search';
import type { BuqForecast, NamedItem } from '@/features/buq/lib/types';
import {
  currencySettingsOptions,
  facilityOptions,
  orderablesByIdsOptions,
  processingPeriodOptions,
} from '@/features/reference-data/api/queries';
import type { CurrencySettings } from '@/features/reference-data/lib/types';
import { useCardLayout } from '@/hooks/use-card-view';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { decimalMark } from '@/lib/decimal';
import { queryKeys } from '@/lib/key-factory';
import { revealField } from '@/lib/reveal-field';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

type SendAction = Exclude<ForecastAction, 'save'>;

type ForecastPageProps = {
  header: ReactNode;
  search: ForecastSearch;
  onSearchChange: SearchChange<ForecastSearch>;
  onOpenDialog: (dialog: NonNullable<ForecastSearch['dialog']>) => void;
  onCloseDialog: () => void;
  onDone: () => void;
};

const sameLine = (a: LineDraft | undefined, b: LineDraft | undefined) =>
  a?.verified === b?.verified && a?.forecasted === b?.forecasted && a?.remarkId === b?.remarkId;

const invalidPart = (line: LineDraft) =>
  numberError(line.verified)
    ? 'verified'
    : numberError(line.forecasted)
      ? 'forecasted'
      : 'remarkId';

const FUNDING_TARGET = 'funding';

const WRITE: Record<ForecastAction, (body: ForecastBody) => Promise<BuqForecast>> = {
  save: saveBuqForecast,
  submit: submitBuqForecast,
  authorize: authorizeBuqForecast,
  submitAndAuthorize: authorizeBuqForecast,
};

const ACTION_LABEL: Record<SendAction, ParseKeys> = {
  submit: 'buq.forecast.submit',
  authorize: 'buq.forecast.authorize',
  submitAndAuthorize: 'buq.forecast.submit-and-authorize',
};

const CONFIRM: Record<SendAction, ParseKeys> = {
  submit: 'buq.forecast.confirm-submit',
  authorize: 'buq.forecast.confirm-authorize',
  submitAndAuthorize: 'buq.forecast.confirm-submit-and-authorize',
};

const DONE: Record<ForecastAction, { title: ParseKeys; description: ParseKeys }> = {
  save: { title: 'buq.forecast.saved-title', description: 'buq.forecast.saved' },
  submit: { title: 'buq.forecast.submitted-title', description: 'buq.forecast.submitted' },
  authorize: { title: 'buq.forecast.authorized-title', description: 'buq.forecast.authorized' },
  submitAndAuthorize: {
    title: 'buq.forecast.authorized-title',
    description: 'buq.forecast.submitted-and-authorized',
  },
};

export function ForecastEditor({
  forecastId,
  rights,
  skipAuthorization,
  ...page
}: ForecastPageProps & {
  forecastId: string;
  rights: ForecastRights;
  skipAuthorization: boolean;
}) {
  const { data: forecast } = useSuspenseQuery(buqForecastOptions(forecastId));
  const ids = useMemo(
    () => forecast.bottomUpQuantificationLineItems.map(({ orderableId }) => orderableId),
    [forecast],
  );
  const { data: orderables } = useSuspenseQuery(orderablesByIdsOptions(ids));
  const { data: facility } = useSuspenseQuery(facilityOptions(forecast.facilityId));
  const { data: remarks } = useSuspenseQuery(buqRemarksOptions());
  const { data: sources } = useSuspenseQuery(buqSourcesOfFundsOptions());
  const { data: currency } = useSuspenseQuery(currencySettingsOptions());
  const periods = usePeriodNames();
  const period = periods?.find(({ id }) => id === forecast.processingPeriodId);
  const fallback = useQuery({
    ...processingPeriodOptions(forecast.processingPeriodId),
    enabled: !!periods && !period,
  }).data;
  const products = useMemo(() => {
    const byId = new Map(orderables.map((orderable) => [orderable.id, orderable]));
    return Object.fromEntries(
      forecast.bottomUpQuantificationLineItems.map((line) => [
        line.id,
        productInfo(
          byId.get(line.orderableId),
          forecast.programId,
          line.annualAdjustedConsumption ?? 0,
        ),
      ]),
    );
  }, [forecast, orderables]);
  const details: ForecastDetails = {
    region: regionOf(facility.geographicZone),
    council: facility.geographicZone.name,
    facilityType: facility.type.name ?? '',
    facilityCode: facility.code,
    facilityName: facility.name ?? '',
    period: period?.name ?? fallback?.name ?? '',
  };
  return (
    <ForecastForm
      {...page}
      currency={currency}
      details={details}
      forecast={forecast}
      key={forecast.id}
      products={products}
      remarks={remarks}
      rights={rights}
      skipAuthorization={skipAuthorization}
      sources={sources}
    />
  );
}

export function ForecastForm({
  forecast,
  products,
  remarks,
  sources,
  currency,
  rights,
  skipAuthorization,
  details,
  header,
  search,
  onSearchChange,
  onOpenDialog,
  onCloseDialog,
  onDone,
}: ForecastPageProps & {
  forecast: BuqForecast;
  products: Record<string, ProductInfo>;
  remarks: readonly NamedItem[];
  sources: readonly NamedItem[];
  currency: CurrencySettings;
  rights: ForecastRights;
  skipAuthorization: boolean;
  details: ForecastDetails;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const mark = decimalMark(i18n.language);
  const [baseline, setBaseline] = useState(() => initialDraft(forecast, sources, mark));
  const form = useForecastForm(baseline);
  const values = useStore(form.store, (state) => state.values);
  const [attempted, setAttempted] = useState(false);
  const [confirming, setConfirming] = useState<SendAction | null>(null);
  const [invalid, setInvalid] = useState<ParseKeys | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const invalidTarget = useRef<string | null>(null);
  const leaving = useRef(false);

  const actions = forecastActions(forecast.status, rights, skipAuthorization);
  const editable = actions.length > 0;
  const send = actions.find((action): action is SendAction => action !== 'save');
  const prices = useMemo(
    () => Object.fromEntries(Object.entries(products).map(([id, info]) => [id, info.price])),
    [products],
  );
  const models = useMemo(
    () =>
      sortModels(
        forecast.bottomUpQuantificationLineItems.map((line) => ({
          lineId: line.id,
          category: products[line.id]?.category ?? '',
          name: products[line.id]?.name ?? '',
        })),
      ),
    [forecast, products],
  );
  const totals = forecastTotals(values, prices);
  const changedIds = useMemo(
    () =>
      new Set(
        models
          .filter(({ lineId }) => !sameLine(values.lines[lineId], baseline.lines[lineId]))
          .map(({ lineId }) => lineId),
      ),
    [models, values.lines, baseline.lines],
  );
  const invalidIds = useMemo(
    () =>
      new Set(
        models
          .filter(({ lineId }) => {
            const line = values.lines[lineId];
            return line ? !lineValid(line) : false;
          })
          .map(({ lineId }) => lineId),
      ),
    [models, values.lines],
  );
  const shown = (lineId: string) => attempted || changedIds.has(lineId);
  const isLineInvalid = (lineId: string) => shown(lineId) && invalidIds.has(lineId);
  const fundingMissing = attempted && !!send && !fundingComplete(values.funding);
  const { pageSize } = toPaginationState(search);
  const isPageInvalid = (page: number) =>
    models
      .slice(page * pageSize, (page + 1) * pageSize)
      .some(({ lineId }) => isLineInvalid(lineId));
  const dirty =
    changedIds.size > 0 || JSON.stringify(values.funding) !== JSON.stringify(baseline.funding);

  const mutation = useSessionMutation({
    mutationFn: async ({ action, body }: { action: ForecastAction; body: ForecastBody }) => {
      const current = await queryClient.fetchQuery({
        ...buqForecastOptions(body.id),
        staleTime: 0,
      });
      if (!forecastActions(current.status, rights, skipAuthorization).includes(action)) {
        throw new BuqMovedError();
      }
      return WRITE[action](body);
    },
    onSuccess: async (saved, { action }) => {
      setConfirming(null);
      toast.success(t(DONE[action].title), { description: t(DONE[action].description) });
      queryClient.setQueryData(buqForecastOptions(saved.id).queryKey, saved);
      if (action === 'save') {
        const next = initialDraft(saved, sources, mark);
        setBaseline(next);
        form.reset(next);
        setAttempted(false);
      } else {
        leaving.current = true;
        onDone();
      }
      await queryClient.invalidateQueries({ queryKey: [...queryKeys.buq.all, 'list'] });
    },
    onError: (error) => {
      setConfirming(null);
      setFailure(
        error instanceof BuqMovedError
          ? t('buq.forecast.moved')
          : (serverMessage(error) ?? t('buq.forecast.send-error')),
      );
      void queryClient.invalidateQueries({ queryKey: buqForecastOptions(forecast.id).queryKey });
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.buq.all, 'list'] });
    },
  });
  const pending = mutation.isPending;
  const guard = useDiscardGuard(dirty, { pending, allowLeave: () => leaving.current });

  const showInvalid = (description: ParseKeys, lineId?: string) => {
    if (lineId) {
      const index = models.findIndex((model) => model.lineId === lineId);
      const page = Math.floor(index / pageSize);
      onSearchChange({ page: page ? page + 1 : undefined }, true);
      const line = values.lines[lineId];
      invalidTarget.current = `lines.${lineId}.${line ? invalidPart(line) : 'verified'}`;
    } else invalidTarget.current = FUNDING_TARGET;
    setInvalid(description);
  };
  const write = (action: ForecastAction) =>
    mutation.mutate({ action, body: forecastBody(forecast, values, prices) });
  const onSave = () => {
    setAttempted(true);
    const bad = models.find(({ lineId }) => {
      const line = values.lines[lineId];
      return line ? !numbersValid(line) : false;
    });
    if (bad) showInvalid('buq.forecast.invalid-lines', bad.lineId);
    else write('save');
  };
  const onSend = (action: SendAction) => {
    setAttempted(true);
    const bad = models.find(({ lineId }) => invalidIds.has(lineId));
    if (bad) showInvalid('buq.forecast.invalid-lines', bad.lineId);
    else if (!fundingComplete(values.funding)) showInvalid('buq.forecast.invalid-funding');
    else setConfirming(action);
  };
  const money = (value: number) => formatMoney(value, currency);
  const setFunding = (funding: ForecastDraft['funding']) => form.setFieldValue('funding', funding);

  return (
    <>
      <Workspace width="wide">
        {header}
        <WorkspaceContent>
          <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
            <div className="flex flex-wrap items-center gap-2">
              {buqStatusBadge(t, forecast.status)}
            </div>
            <ForecastDetailsList details={details} />
            <ForecastGrid
              cards={cards}
              currency={currency}
              disabled={!editable || pending}
              form={form}
              isLineInvalid={isLineInvalid}
              isPageInvalid={isPageInvalid}
              models={models}
              onSearchChange={onSearchChange}
              products={products}
              remarks={remarks}
              search={search}
              shown={shown}
            />
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="wide">
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={onDone} size="lg" variant="outline">
            {t('buq.forecast.cancel')}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="font-medium text-sm tabular-nums">
            {t('buq.forecast.total-cost', { total: money(totals.totalCost) })}
          </span>
          <Button
            disabled={pending}
            onClick={() => onOpenDialog('funding')}
            size="lg"
            variant={fundingMissing ? 'destructive-outline' : 'outline'}
          >
            {t('buq.forecast.funding')}
          </Button>
          {canViewRejection(forecast.status, rights) && (
            <Button
              disabled={pending}
              onClick={() => onOpenDialog('rejection')}
              size="lg"
              variant="outline"
            >
              {t('buq.forecast.rejection')}
            </Button>
          )}
          {actions.includes('save') && (
            <Button
              disabled={pending}
              focusableWhenDisabled={pending}
              onClick={onSave}
              size="lg"
              variant="outline"
            >
              {pending && mutation.variables?.action === 'save' && (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              )}
              {t('buq.forecast.save')}
            </Button>
          )}
          {send && (
            <Button disabled={pending} onClick={() => onSend(send)} size="lg">
              {t(ACTION_LABEL[send])}
            </Button>
          )}
        </div>
      </WorkspaceFooter>
      <FundingDialog
        currency={currency}
        editable={editable && !pending}
        onClose={onCloseDialog}
        onSave={setFunding}
        open={search.dialog === 'funding'}
        required={fundingMissing}
        rows={values.funding}
        totalCost={totals.totalCost}
      />
      <RejectionDialog
        forecastId={forecast.id}
        onClose={onCloseDialog}
        open={search.dialog === 'rejection' && canViewRejection(forecast.status, rights)}
      />
      <AlertDialog
        onOpenChange={(open) => !open && !pending && setConfirming(null)}
        open={confirming !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming && t(ACTION_LABEL[confirming])}</AlertDialogTitle>
            <AlertDialogDescription>{confirming && t(CONFIRM[confirming])}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('dialog.cancel')}</AlertDialogCancel>
            <Button
              disabled={pending}
              focusableWhenDisabled
              onClick={() => confirming && write(confirming)}
            >
              {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
              {confirming && t(ACTION_LABEL[confirming])}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <InvalidSubmitDialog
        closeLabel={t('dialog.close')}
        description={invalid ? t(invalid) : undefined}
        onOpenChange={(open) => !open && setInvalid(null)}
        onOpenChangeComplete={(open) => {
          const target = invalidTarget.current;
          if (open || !target) return;
          if (target === FUNDING_TARGET) {
            onOpenDialog('funding');
            return;
          }
          const field = document.querySelector<HTMLElement>(`[id="${target}"]`);
          if (field) revealField(field, !!field.closest('li'));
        }}
        open={invalid !== null}
        title={t('buq.forecast.invalid-title')}
      />
      <InvalidSubmitDialog
        closeLabel={t('dialog.close')}
        description={failure ?? undefined}
        onOpenChange={(open) => !open && setFailure(null)}
        open={failure !== null}
        title={t('buq.forecast.send-error-title')}
      />
      <DiscardChangesDialog {...guard.dialog} description={t('buq.forecast.discard')} />
    </>
  );
}
