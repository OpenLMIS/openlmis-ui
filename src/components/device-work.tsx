import { createContext, useContext } from 'react';

export type DeviceWork = {
  hasDeviceEvents: boolean;
  waiting: number;
  uncertain: number;
  refused: number;
  sending: boolean;
  retained: boolean;
  pauses: readonly ('access-changed' | 'draft-changed')[];
  countUnsyncedWork: () => Promise<number>;
};
export const DeviceWorkContext = createContext<DeviceWork>({
  hasDeviceEvents: false,
  waiting: 0,
  uncertain: 0,
  refused: 0,
  sending: false,
  retained: false,
  pauses: [],
  countUnsyncedWork: async () => {
    throw new Error('Device work is not available.');
  },
});
export const useDeviceWork = () => useContext(DeviceWorkContext);
