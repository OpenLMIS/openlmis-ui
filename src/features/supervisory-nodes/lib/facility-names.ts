export function facilityNames(facilities: readonly { id: string; name: string }[]) {
  return new Map(facilities.map(({ id, name }) => [id, name]));
}
