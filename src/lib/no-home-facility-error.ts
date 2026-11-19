import type { LinkProps } from '@tanstack/react-router';

export class NoHomeFacilityError extends Error {
  readonly back: NonNullable<LinkProps['to']>;

  constructor({ back }: { back: NonNullable<LinkProps['to']> }) {
    super('No home facility is assigned.');
    this.name = 'NoHomeFacilityError';
    this.back = back;
  }
}
