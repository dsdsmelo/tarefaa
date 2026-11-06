// Capacidade planejável por dia da semana (tabela user_planning_settings).

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type PlanningSettings = Record<WeekdayKey, number>;

/** Segunda a domingo, com o índice de Date.getDay() (0 = domingo) */
export const WEEKDAYS: { key: WeekdayKey; label: string; jsDay: number }[] = [
  { key: 'mon', label: 'Segunda', jsDay: 1 },
  { key: 'tue', label: 'Terça', jsDay: 2 },
  { key: 'wed', label: 'Quarta', jsDay: 3 },
  { key: 'thu', label: 'Quinta', jsDay: 4 },
  { key: 'fri', label: 'Sexta', jsDay: 5 },
  { key: 'sat', label: 'Sábado', jsDay: 6 },
  { key: 'sun', label: 'Domingo', jsDay: 0 },
];

/** Mesmo padrão do banco: 6h de segunda a sexta, 0 no fim de semana */
export const DEFAULT_PLANNING: PlanningSettings = { mon: 360, tue: 360, wed: 360, thu: 360, fri: 360, sat: 0, sun: 0 };

export const MAX_DAY_CAPACITY = 1440;

const weekdayOf = (iso: string): WeekdayKey => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  return WEEKDAYS.find(w => w.jsDay === jsDay)!.key;
};

/** Capacidade, em minutos, do dia "YYYY-MM-DD" (data local) */
export const capacityFor = (settings: PlanningSettings, iso: string): number => settings[weekdayOf(iso)];

export function settingsFromRow(row: Record<string, unknown> | null | undefined): PlanningSettings {
  if (!row) return { ...DEFAULT_PLANNING };
  const out = { ...DEFAULT_PLANNING };
  for (const { key } of WEEKDAYS) {
    const v = row[`${key}_minutes`];
    if (typeof v === 'number') out[key] = v;
  }
  return out;
}

export function settingsToRow(settings: PlanningSettings): Record<string, number> {
  return Object.fromEntries(WEEKDAYS.map(({ key }) => [`${key}_minutes`, settings[key]]));
}

export type CapacityLevel = 'none' | 'ok' | 'warning' | 'over';

/** Abaixo de 80% neutro; de 80% a 100% alerta; acima de 100% excesso; capacidade 0 = sem capacidade */
export function capacityLevel(plannedMinutes: number, capacityMinutes: number): CapacityLevel {
  if (capacityMinutes <= 0) return 'none';
  const ratio = plannedMinutes / capacityMinutes;
  if (ratio > 1) return 'over';
  if (ratio >= 0.8) return 'warning';
  return 'ok';
}
