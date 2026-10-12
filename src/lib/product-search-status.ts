type ProductSearchStatus = {
  key: 'lots.search-hint' | 'lots.search-more';
  shown: number;
  count: number;
};

export function productSearchStatus({
  listed,
  total,
  typed,
}: {
  listed: number;
  total: number;
  typed: boolean;
}): ProductSearchStatus | undefined {
  if (total <= listed) return undefined;
  return { key: typed ? 'lots.search-more' : 'lots.search-hint', shown: listed, count: total };
}
