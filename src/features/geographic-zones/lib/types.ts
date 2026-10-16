export type GeographicZonesQuery = {
  page: number;
  size: number;
  sort: 'name';
  name?: string | undefined;
  code?: string | undefined;
  parent?: string | undefined;
  levelNumber?: number | undefined;
};
