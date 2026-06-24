const MS_PER_DAY = 86_400_000;
const utcMidnight = (d: Date): number => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
export function daysBetween(from: Date, to: Date): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / MS_PER_DAY);
}
export function daysUntil(target: Date, from: Date = new Date()): number {
  return daysBetween(from, target);
}
/** Segunda-feira (00:00 UTC) da semana ISO de `d`. Usado p/ agrupar snapshots semanais. */
export function isoWeekStart(d: Date): Date {
  const date = new Date(utcMidnight(d));
  const day = date.getUTCDay(); // 0=Dom..6=Sáb
  date.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return date;
}
