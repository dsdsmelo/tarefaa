// Datas em português escritas na captura rápida (regras próprias, testadas em
// src/test/quickCapture.test.ts). Tudo em datas locais "YYYY-MM-DD", sem UTC.
import { fold, isWordChar } from './text';

/**
 * 'due' = data com marcador de prazo ("até sexta", "prazo sexta", "vence dia 10");
 * 'planned' = data simples ("sexta"). Na Etapa 2 as duas vão para end_date; na
 * Etapa 3 a 'planned' passa a ir para planned_date.
 */
export type DateKind = 'due' | 'planned';

export interface DateMatch {
  /** Início do token, incluindo marcador e preposição ("até a sexta") */
  start: number;
  end: number;
  /** Início da expressão de data em si ("sexta") */
  coreStart: number;
  /** Expressão de data no texto dobrado (minúsculas, sem acento), para ignorar */
  key: string;
  iso: string;
  kind: DateKind;
}

// ---------- Aritmética de datas locais ----------
const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const daysInMonth = (year: number, month1: number) => new Date(year, month1, 0).getDate();

export const addDays = (iso: string, days: number) => {
  const d = fromISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
};

const addMonths = (iso: string, months: number) => {
  const d = fromISO(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const day = Math.min(d.getDate(), daysInMonth(target.getFullYear(), target.getMonth() + 1));
  return toISO(new Date(target.getFullYear(), target.getMonth(), day));
};

/** Próxima ocorrência do dia da semana, sempre depois de hoje (0 = domingo) */
const nextWeekday = (iso: string, weekday: number) => {
  const delta = (weekday - fromISO(iso).getDay() + 7) % 7 || 7;
  return addDays(iso, delta);
};

const endOfMonth = (iso: string) => {
  const d = fromISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

/** "dia N": hoje ou a próxima vez em que o mês tem o dia N */
const nextDayOfMonth = (iso: string, day: number): string | null => {
  if (day < 1 || day > 31) return null;
  const today = fromISO(iso);
  for (let i = 0; i < 13; i++) {
    const y = today.getFullYear();
    const m = today.getMonth() + i; // pode passar de 11; o Date normaliza
    const first = new Date(y, m, 1);
    if (daysInMonth(first.getFullYear(), first.getMonth() + 1) < day) continue;
    const candidate = toISO(new Date(first.getFullYear(), first.getMonth(), day));
    if (candidate >= iso) return candidate;
  }
  return null;
};

/** Data absoluta; sem ano, usa a próxima ocorrência (hoje conta) */
const absoluteDate = (iso: string, day: number, month: number, year?: number): string | null => {
  if (month < 1 || month > 12 || day < 1) return null;
  const build = (y: number) => (day <= daysInMonth(y, month) ? `${y}-${pad(month)}-${pad(day)}` : null);
  if (year !== undefined) return build(year < 100 ? 2000 + year : year);
  const thisYear = fromISO(iso).getFullYear();
  const candidate = build(thisYear);
  if (candidate && candidate >= iso) return candidate;
  return build(thisYear + 1);
};

// ---------- Vocabulário (texto dobrado) ----------
const WEEKDAYS: [string, number][] = [
  ['domingo', 0], ['dom', 0],
  ['segunda', 1], ['seg', 1],
  ['terca', 2],
  ['quarta', 3], ['qua', 3],
  ['quinta', 4], ['qui', 4],
  ['sexta', 5], ['sex', 5],
  ['sabado', 6], ['sab', 6],
];
const WEEKDAY_INDEX = new Map(WEEKDAYS);

const MONTHS: [string, number][] = [
  ['janeiro', 1], ['jan', 1], ['fevereiro', 2], ['fev', 2], ['marco', 3], ['mar', 3],
  ['abril', 4], ['abr', 4], ['maio', 5], ['mai', 5], ['junho', 6], ['jun', 6],
  ['julho', 7], ['jul', 7], ['agosto', 8], ['ago', 8], ['setembro', 9], ['set', 9],
  ['outubro', 10], ['out', 10], ['novembro', 11], ['nov', 11], ['dezembro', 12], ['dez', 12],
];
const MONTH_INDEX = new Map(MONTHS);

const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
  sete: 7, oito: 8, nove: 9, dez: 10, quinze: 15, vinte: 20, trinta: 30,
};
const toNumber = (word: string) => (/^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word]);

const alt = (words: string[]) => [...words].sort((a, b) => b.length - a.length).join('|');
const WEEKDAY_RE = alt(WEEKDAYS.map(([w]) => w));
const MONTH_RE = alt(MONTHS.map(([w]) => w));
const NUMBER_RE = `\\d{1,3}|${alt(Object.keys(NUMBER_WORDS))}`;

type Resolver = (m: RegExpExecArray, today: string) => string | null;

const PATTERNS: [RegExp, Resolver][] = [
  [/depois de amanha/g, (_, t) => addDays(t, 2)],
  [/amanha/g, (_, t) => addDays(t, 1)],
  [/hoje/g, (_, t) => t],
  [new RegExp(`(?:daqui a|daqui|em|dentro de) (${NUMBER_RE}) (dias?|semanas?|mes|meses)`, 'g'), (m, t) => {
    const n = toNumber(m[1]);
    if (!n) return null;
    if (m[2].startsWith('dia')) return addDays(t, n);
    if (m[2].startsWith('semana')) return addDays(t, 7 * n);
    return addMonths(t, n);
  }],
  [/semana que vem|proxima semana/g, (_, t) => nextWeekday(t, 1)],
  [/(?:fim|final) do mes/g, (_, t) => endOfMonth(t)],
  [new RegExp(`(?:proxim[ao] )?(${WEEKDAY_RE})(?:[- ]feira)?`, 'g'), (m, t) => nextWeekday(t, WEEKDAY_INDEX.get(m[1])!)],
  [/dia (\d{1,2})/g, (m, t) => nextDayOfMonth(t, Number(m[1]))],
  [/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?/g, (m, t) =>
    absoluteDate(t, Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : undefined)],
  [new RegExp(`(\\d{1,2})(?:º|o)? de (${MONTH_RE})(?: de (\\d{4}))?`, 'g'), (m, t) =>
    absoluteDate(t, Number(m[1]), MONTH_INDEX.get(m[2])!, m[3] ? Number(m[3]) : undefined)],
];

// Antes da data: marcador de prazo (opcional) e preposição (opcional)
const PREFIX_RE = /(?:^|[^\p{L}\p{N}])((?:(ate|prazo:?|vence|vencimento:?)\s+)?(?:(?:o|a|na|no|em|para|pra|de|do|da)\s+)?(?:dia\s+)?)$/u;

/**
 * Todas as expressões de data do texto, sem sobreposição (a mais longa vence),
 * na ordem em que aparecem. `text` deve ser o texto original (ou mascarado).
 */
export function findDates(text: string, today: string): DateMatch[] {
  const folded = fold(text);
  const raw: { start: number; end: number; iso: string }[] = [];

  for (const [pattern, resolve] of PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(folded))) {
      const start = m.index;
      const end = start + m[0].length;
      if (isWordChar(folded[start - 1]) || isWordChar(folded[end]) || folded[end] === '/') continue;
      const iso = resolve(m, today);
      if (iso) raw.push({ start, end, iso });
    }
  }

  // Sem sobreposição: mais longa primeiro, depois a que começa antes
  raw.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const kept: typeof raw = [];
  for (const r of raw) {
    if (!kept.some(k => r.start < k.end && k.start < r.end)) kept.push(r);
  }
  kept.sort((a, b) => a.start - b.start);

  return kept.map(r => {
    const prefix = PREFIX_RE.exec(folded.slice(0, r.start));
    const consumed = prefix?.[1] ?? '';
    return {
      start: r.start - consumed.length,
      end: r.end,
      coreStart: r.start,
      key: folded.slice(r.start, r.end),
      iso: r.iso,
      kind: prefix?.[2] ? 'due' : 'planned',
    };
  });
}

/** Data de um campo só de data (tecla "d" da triagem): a última expressão encontrada */
export function parseDateText(text: string, today: string): { iso: string; kind: DateKind } | null {
  const found = findDates(text, today);
  const last = found[found.length - 1];
  return last ? { iso: last.iso, kind: last.kind } : null;
}

// Hora escrita junto ("às 15h", "15:30", "às 3"): não é salva (o prazo é só data)
const TIME_RE = /(?:as\s+)?\d{1,2}(?::\d{2}|h(?:\d{2})?)|as\s+\d{1,2}/g;

export function findTimes(text: string): { start: number; end: number }[] {
  const folded = fold(text);
  const out: { start: number; end: number }[] = [];
  TIME_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TIME_RE.exec(folded))) {
    const start = m.index;
    const end = start + m[0].length;
    if (isWordChar(folded[start - 1]) || isWordChar(folded[end]) || folded[end] === '/') continue;
    out.push({ start, end });
  }
  return out;
}
