import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { onlineManager } from '@tanstack/react-query';
import { configure } from '@testing-library/react';
import { type ComponentProps, createElement } from 'react';
import { afterEach, vi } from 'vitest';

configure({ asyncUtilTimeout: 10_000 });

afterEach(() => onlineManager.setOnline(true));

vi.mock('react-day-picker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-day-picker')>();
  function YearsDropdown({ options, ...props }: ComponentProps<typeof actual.YearsDropdown>) {
    const year = Number(props.value);
    return createElement(actual.YearsDropdown, {
      ...props,
      options: options?.filter(
        (option, index) =>
          index === 0 ||
          index === options.length - 1 ||
          option.value % 100 === 0 ||
          Math.abs(option.value - year) <= 1,
      ),
    });
  }
  return {
    ...actual,
    DayPicker: (props: ComponentProps<typeof actual.DayPicker>) =>
      createElement(actual.DayPicker, {
        ...props,
        components: { ...props.components, YearsDropdown },
      }),
  };
});
