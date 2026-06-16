const MS_PER_DAY = 86_400_000;
const utcMidnight = (d: Date): number => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
export function daysBetween(from: Date, to: Date): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / MS_PER_DAY);
}
export function daysUntil(target: Date, from: Date = new Date()): number {
  return daysBetween(from, target);
}
