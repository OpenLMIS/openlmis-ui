import { createContext, type ReactNode, useContext } from 'react';

const PageHiddenContext = createContext(false);

export function PageVisibility({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return <PageHiddenContext value={hidden}>{children}</PageHiddenContext>;
}

export const usePageHidden = () => useContext(PageHiddenContext);
