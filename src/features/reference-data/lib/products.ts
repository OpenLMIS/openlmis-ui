export function productLabel(orderable: {
  fullProductName?: string | null;
  productCode: string;
  dispensable?: { displayUnit?: string | null };
}): string {
  const name = orderable.fullProductName || orderable.productCode;
  const unit = orderable.dispensable?.displayUnit;
  return unit ? `${name} - ${unit}` : name;
}
