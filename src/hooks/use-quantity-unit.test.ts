import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useAppConfigurationStore } from '@/lib/app-configuration';

const initial = useAppConfigurationStore.getState();

function setFlags(featureFlags: Record<string, string>) {
  useAppConfigurationStore.setState({
    configuration: { ...initial.configuration, featureFlags },
  });
}

afterEach(() => {
  useAppConfigurationStore.setState(initial, true);
  localStorage.clear();
});

describe('useQuantityUnit', () => {
  it('starts in doses and offers both units by default', () => {
    const { result } = renderHook(() => useQuantityUnit());

    expect(result.current.unit).toBe('DOSES');
    expect(result.current.canSwitch).toBe(true);
  });

  it('starts in the default unit the administrator set', () => {
    setFlags({ DEFAULT_QUANTITY_UNIT: 'PACKS' });

    expect(renderHook(() => useQuantityUnit()).result.current.unit).toBe('PACKS');
  });

  it('keeps the unit the user picks, over the default, after a reload', () => {
    const { result } = renderHook(() => useQuantityUnit());
    act(() => result.current.setUnit('PACKS'));

    expect(result.current.unit).toBe('PACKS');
    expect(renderHook(() => useQuantityUnit()).result.current.unit).toBe('PACKS');
  });

  it('hides the switch with one unit offered, still showing the default unit', () => {
    setFlags({ QUANTITY_UNIT_OPTION: 'PACKS' });

    const { result } = renderHook(() => useQuantityUnit());

    expect(result.current.canSwitch).toBe(false);
    expect(result.current.unit).toBe('DOSES');
  });
});
