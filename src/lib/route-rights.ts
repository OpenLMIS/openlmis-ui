import type { StaticDataRouteOption } from '@tanstack/react-router';

export type RouteWithRights = {
  id?: string;
  options: { staticData?: StaticDataRouteOption };
  parentRoute?: RouteWithRights;
};

export function routeRights(route: RouteWithRights | undefined): readonly string[] | undefined {
  for (let current = route; current; current = current.parentRoute) {
    const rights = current.options.staticData?.rights;
    if (rights) return rights;
  }
}
