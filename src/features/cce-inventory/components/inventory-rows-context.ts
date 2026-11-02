import { createContext } from 'react';
import type { InventoryAlert, InventoryItem } from '@/features/cce-inventory/lib/types';

export type InventoryRowActions = {
  details: (item: InventoryItem) => void;
  statusUpdate: ((item: InventoryItem) => void) | undefined;
};

export type InventoryRows = {
  activeAlerts: Map<string, InventoryAlert[]>;
  actions: InventoryRowActions | undefined;
  stale: boolean;
};

export const InventoryRowsContext = createContext<InventoryRows>({
  activeAlerts: new Map(),
  actions: undefined,
  stale: false,
});
