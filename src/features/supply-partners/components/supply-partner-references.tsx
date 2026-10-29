import { useQueries, useSuspenseQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { ErrorAlert } from '@/components/display/dialog-parts';
import { CellText } from '@/components/display/table-cards';
import { Skeleton } from '@/components/ui/skeleton';
import {
  facilitiesByIdsOptions,
  orderablesByIdsOptions,
  programsOptions,
  supervisoryNodesByIdsOptions,
} from '@/features/reference-data/api/queries';
import type { AssociationDraft } from '@/features/supply-partners/lib/types';

function referenceQueries(associations: readonly AssociationDraft[]) {
  const ids = (read: (item: AssociationDraft) => string[]) =>
    [...new Set(associations.flatMap(read))].sort();
  return [
    programsOptions(),
    supervisoryNodesByIdsOptions(ids((item) => [item.supervisoryNodeId])),
    facilitiesByIdsOptions(ids((item) => item.facilityIds)),
    orderablesByIdsOptions(ids((item) => item.orderableIds)),
  ] as const;
}
function referencesComplete(
  associations: readonly AssociationDraft[],
  programs: readonly { id: string }[],
  nodes: readonly { id: string }[],
  facilities: readonly { id: string }[],
  products: readonly { id: string }[],
) {
  const ids = (records: readonly { id: string }[]) => new Set(records.map(({ id }) => id));
  const programIds = ids(programs);
  const nodeIds = ids(nodes);
  const facilityIds = ids(facilities);
  const productIds = ids(products);
  return associations.every(
    (item) =>
      programIds.has(item.programId) &&
      nodeIds.has(item.supervisoryNodeId) &&
      item.facilityIds.every((id) => facilityIds.has(id)) &&
      item.orderableIds.every((id) => productIds.has(id)),
  );
}
export function usePartnerReferences(associations: readonly AssociationDraft[]) {
  const queries = referenceQueries(associations);
  const enabled = associations.length > 0;
  const [programs, nodes, facilities, products] = useQueries({
    queries: [
      { ...queries[0], enabled },
      { ...queries[1], enabled },
      { ...queries[2], enabled },
      { ...queries[3], enabled },
    ],
  });
  const resolved =
    programs.isSuccess && nodes.isSuccess && facilities.isSuccess && products.isSuccess;
  const complete =
    !enabled ||
    (resolved &&
      referencesComplete(associations, programs.data, nodes.data, facilities.data, products.data));
  return { programs, nodes, facilities, products, complete };
}
export function ReferenceStatus({ associations }: { associations: readonly AssociationDraft[] }) {
  const { t } = useTranslation();
  return (
    <QueryBoundary
      resetKey={JSON.stringify(associations)}
      pendingFallback={
        <div className="h-4 w-56">
          <Skeleton fill />
        </div>
      }
      errorComponent={({ error, reset }) => (
        <ListError
          error={error}
          reset={reset}
          title={t('supply-partners.lookup-error-title')}
          description={t('supply-partners.load-error')}
        />
      )}
    >
      <ResolvedStatus associations={associations} />
    </QueryBoundary>
  );
}
function ResolvedStatus({ associations }: { associations: readonly AssociationDraft[] }) {
  const { t } = useTranslation();
  const [programs, nodes, facilities, products] = useSuspenseQueries({
    queries: referenceQueries(associations),
  });
  const failed = [programs, nodes, facilities, products].find((query) => query.isError);
  if (failed)
    return (
      <ListError
        error={failed.error}
        reset={() => void failed.refetch()}
        title={t('supply-partners.lookup-error-title')}
        description={t('supply-partners.load-error')}
      />
    );
  const complete = referencesComplete(
    associations,
    programs.data,
    nodes.data,
    facilities.data,
    products.data,
  );
  return complete ? null : (
    <ErrorAlert
      title={t('supply-partners.unavailable')}
      description={t('supply-partners.missing-references')}
    />
  );
}
export function ReferenceName({
  name,
  pending,
}: {
  name: string | null | undefined;
  pending: boolean;
}) {
  const { t } = useTranslation();
  return pending ? (
    <div className="h-4 w-32">
      <Skeleton fill />
    </div>
  ) : (
    <CellText overflow="nowrap">
      {name === undefined ? t('supply-partners.unavailable') : name}
    </CellText>
  );
}
