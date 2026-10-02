import { createContext, useContext } from 'react';

export const BackToProducts = createContext<() => void>(() => {});

export const useBackToProducts = () => useContext(BackToProducts);
