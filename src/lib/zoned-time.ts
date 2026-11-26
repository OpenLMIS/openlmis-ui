import { tzOffset } from '@date-fns/tz';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const WALL_TIME = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/;

export function toZonedParts(instant: string, zone: string) {
  const date = new Date(instant);
  const wall = new Date(date.getTime() + tzOffset(zone, date) * MINUTE_MS).toISOString();
  return { date: wall.slice(0, 10), time: wall.slice(11, 16) };
}

export function fromZonedParts(
  date: string,
  time: string,
  zone: string,
  { endOfMinute = false } = {},
): string | null {
  const wall = `${date}T${time}`;
  if (!WALL_TIME.test(wall)) return null;
  const base = Date.parse(`${wall}:00.000Z`);
  if (!Number.isFinite(base) || new Date(base).toISOString().slice(0, 16) !== wall) return null;

  // Try the offsets on both sides of a possible clock change.
  const offsets = new Set(
    [base - DAY_MS, base, base + DAY_MS].map((instant) => tzOffset(zone, new Date(instant))),
  );
  let earliest = Infinity;
  for (const offset of offsets) {
    const instant = new Date(base - offset * MINUTE_MS);
    if (tzOffset(zone, instant) === offset) earliest = Math.min(earliest, instant.getTime());
  }
  return Number.isFinite(earliest)
    ? new Date(earliest + (endOfMinute ? MINUTE_MS - 1 : 0)).toISOString()
    : null;
}
