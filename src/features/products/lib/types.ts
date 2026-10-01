/** A row of the products list; the server calls products orderables. */
export type Product = {
  id: string;
  productCode: string;
  fullProductName: string | null;
  description: string | null;
};

/** Normalized request for one page of products; also the query key, so equal requests share a cache entry. */
export type ProductsQuery = {
  page: number;
  size: number;
  sort: string;
  /** Contains, ignoring case. */
  code?: string | undefined;
  /** Contains, ignoring case. */
  name?: string | undefined;
  /** A program code, matched exactly ignoring case. */
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
