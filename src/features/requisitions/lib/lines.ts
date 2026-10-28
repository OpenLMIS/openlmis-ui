import type {
  Requisition,
  RequisitionApprovedProduct,
  RequisitionLineItem,
  RequisitionProduct,
  RequisitionProgramEntry,
  VersionIdentity,
} from '@/features/requisitions/lib/requisition';

export type RequisitionLine = {
  canSkip?: boolean;
  line: RequisitionLineItem;
  product: RequisitionProduct | undefined;
  approvedProduct: RequisitionApprovedProduct | undefined;
  program: RequisitionProgramEntry | undefined;
  fullSupply: boolean;
  categoryName: string;
  categoryOrder: number;
  productOrder: number;
};

const identityKey = (id: string, version?: number) => `${id}:${version ?? ''}`;

export function buildLines(
  requisition: Requisition,
  products: readonly RequisitionProduct[],
  approvedProducts: readonly RequisitionApprovedProduct[] = [],
): RequisitionLine[] {
  const productMap = new Map(products.map((p) => [identityKey(p.id, p.meta?.versionNumber), p]));
  const approvedMap = new Map(
    approvedProducts.map((p) => [identityKey(p.id, p.meta?.versionNumber), p]),
  );
  const resolve = <T>(map: Map<string, T>, identity?: VersionIdentity) =>
    identity ? map.get(identityKey(identity.id, identity.versionNumber)) : undefined;
  return requisition.requisitionLineItems
    .map((line) => {
      const product = resolve(productMap, line.orderable);
      const program = product?.programs?.findLast((p) => p.programId === requisition.program.id);
      return {
        line,
        product,
        approvedProduct: resolve(approvedMap, line.approvedProduct),
        program,
        fullSupply: program?.fullSupply ?? false,
        categoryName: program?.orderableCategoryDisplayName ?? '',
        categoryOrder: program?.orderableCategoryDisplayOrder ?? 0,
        productOrder: program?.displayOrder ?? 0,
      };
    })
    .sort(
      (a, b) =>
        a.categoryOrder - b.categoryOrder ||
        a.categoryName.localeCompare(b.categoryName) ||
        a.productOrder - b.productOrder ||
        (a.product?.fullProductName ?? '').localeCompare(b.product?.fullProductName ?? ''),
    );
}

export function splitLines(lines: readonly RequisitionLine[]) {
  return {
    fullSupply: lines.filter((l) => l.fullSupply),
    nonFullSupply: lines.filter((l) => !l.fullSupply),
  };
}

export function filterLines(
  lines: readonly RequisitionLine[],
  options: { hideSkipped?: boolean; product?: string; showSkipped?: boolean } = {},
) {
  const hideSkipped = options.hideSkipped && !options.showSkipped;
  const query = options.product?.trim().toLocaleLowerCase() ?? '';
  return lines.filter(
    (l) =>
      !(hideSkipped && l.line.skipped) &&
      (!query ||
        l.product?.fullProductName?.toLocaleLowerCase().includes(query) ||
        l.product?.productCode.toLocaleLowerCase().includes(query)),
  );
}
