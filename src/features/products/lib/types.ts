export type Product = {
  id: string;
  productCode: string;
  fullProductName: string | null;
  description: string | null;
};

export type ProductDetail = Product & {
  netContent: number;
  packRoundingThreshold: number;
  roundToZero: boolean;
  dispensable: { dispensingUnit?: string | null; sizeCode?: string | null; [key: string]: unknown };
  [key: string]: unknown;
};

export type ProductsQuery = {
  page: number;
  size: number;
  sort: string;
  q?: string | undefined;
  program?: string | undefined;
};

export type CreateProductBody = {
  productCode: string;
  fullProductName?: string | undefined;
  description?: string | undefined;
  dispensable: { dispensingUnit: string };
  netContent: number;
  packRoundingThreshold: number;
  roundToZero: boolean;
};
