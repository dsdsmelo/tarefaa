// Estimativa de tarefa em minutos (tasks.estimate_minutes, 1 a 1440).
// Aceita "30m", "30 min", "45", "2h", "1,5h", "1h30", "1h30m", "1h 30m", "1:30".

export const MIN_ESTIMATE = 1;
export const MAX_ESTIMATE = 1440;

const inRange = (n: number) => Number.isInteger(n) && n >= MIN_ESTIMATE && n <= MAX_ESTIMATE;

/** Minutos a partir do texto digitado; null se não entender ou fora de 1 a 1440 */
export function parseEstimate(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;
  let m: RegExpMatchArray | null;
  let minutes: number | null = null;
  if ((m = t.match(/^(\d{1,4})(?:m|min|mins|minutos?)?$/))) {
    minutes = Number(m[1]);
  } else if ((m = t.match(/^(\d{1,2})(?:[.,](\d{1,2}))?h$/))) {
    minutes = Math.round((Number(m[1]) + (m[2] ? Number(`0.${m[2]}`) : 0)) * 60);
  } else if ((m = t.match(/^(\d{1,2})h(\d{1,2})(?:m|min)?$/))) {
    if (Number(m[2]) >= 60) return null;
    minutes = Number(m[1]) * 60 + Number(m[2]);
  } else if ((m = t.match(/^(\d{1,2}):(\d{2})$/))) {
    if (Number(m[2]) >= 60) return null;
    minutes = Number(m[1]) * 60 + Number(m[2]);
  }
  return minutes !== null && inRange(minutes) ? minutes : null;
}

/** 45 -> "45m", 120 -> "2h", 90 -> "1h 30m", 0 -> "0h" */
export function formatMinutes(total: number): string {
  const n = Math.max(0, Math.round(total));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h === 0) return m === 0 ? '0h' : `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
