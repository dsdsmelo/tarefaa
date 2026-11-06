// Parser da captura rápida: "ligar pro João amanhã p1 #Cliente X @Maria"
// vira nome "ligar pro João", planejada para amanhã, prioridade urgente, projeto
// "Cliente X" e responsável "Maria". Puro e testado (src/test/quickCapture.test.ts).
//
// Regras:
// - #projeto e @pessoa: casa com o nome existente MAIS LONGO que começa logo
//   depois do # ou @, ignorando maiúsculas e acentos, com fim de palavra depois
//   ("#Cliente X" casa com "Cliente X", não com "Cliente"). Sem casamento, o texto
//   fica no nome e a tarefa vai para a Caixa de entrada.
// - Pessoa: nome completo, ou só o primeiro nome quando ele é único.
// - Prioridade: p1 urgente, p2 alta, p3 média, p4 baixa; sem p, média.
// - Datas: data simples ("sexta", "amanhã", "15/11") é a data PLANEJADA
//   (planned_date); com marcador de prazo ("até sexta", "prazo sexta",
//   "vence sexta") é o PRAZO (end_date). As duas podem vir na mesma frase.
//   Vale a ÚLTIMA de cada tipo; as outras ficam no nome.
//   Hora não é salva (as datas guardam só o dia) e fica no nome.
// - Estimativa: "~30m", "~2h", "~1h30" (1 min a 24 h). Vale a última.
// - Aguardando (Etapa 4, D6): "aguardando @Maria" ou "aguardando Maria" (pessoa
//   cadastrada; a menção NÃO vira responsável), senão a palavra seguinte vira
//   texto livre ("aguardando cliente"); várias palavras entre aspas
//   ("aguardando \"equipe jurídica\""). A data simples da frase vira a data de
//   cobrança (não a planejada); quem decide é a tela (QuickCaptureDialog).
// - Mais de um #projeto: vale o último; mais de um @pessoa: todas.
// - Chip removido na prévia: a expressão volta para o nome (ver ParseIgnore).
import type { TaskPriority } from '@/lib/types';
import { parseEstimate } from '@/lib/estimate';
import { findDates, findTimes, type DateKind } from './dates';
import { fold, isWordChar, mask, removeSpans, type Span } from './text';

export interface CaptureEntity {
  id: string;
  name: string;
}

/** Itens que o usuário removeu da prévia: voltam a ser texto do nome */
export interface ParseIgnore {
  /** `key` das datas removidas ("planned:sexta", "due:sexta") */
  dates?: string[];
  /** `key` das estimativas removidas */
  estimates?: string[];
  /** Chip "Aguardando" removido */
  waiting?: boolean;
  /** prioridades removidas ('p1'...'p4') */
  priorities?: string[];
  projectIds?: string[];
  personIds?: string[];
}

export interface ParseContext {
  /** Hoje, "YYYY-MM-DD" no fuso local */
  today: string;
  projects: CaptureEntity[];
  people: CaptureEntity[];
  ignore?: ParseIgnore;
}

export interface ParsedDate extends Span {
  iso: string;
  kind: DateKind;
  /** "<kind>:<expressão>": identifica o chip para removê-lo */
  key: string;
}

export interface ParsedEstimate extends Span {
  minutes: number;
  key: string;
}

export interface ParsedWaiting extends Span {
  /** Pessoa cadastrada de quem se espera */
  person: CaptureEntity | null;
  /** Ou texto livre (até 120 caracteres) */
  onText: string | null;
}

export interface ParsedCapture {
  /** Nome da tarefa: o texto sem os itens reconhecidos */
  name: string;
  /** Data planejada (planned_date): data simples */
  planned: ParsedDate | null;
  /** Prazo (end_date): data com marcador de prazo */
  due: ParsedDate | null;
  estimate: ParsedEstimate | null;
  /** "aguardando fulano": status Aguardando */
  waiting: ParsedWaiting | null;
  priority: (Span & { value: TaskPriority; key: string }) | null;
  /** null = Caixa de entrada */
  project: (Span & CaptureEntity) | null;
  people: (Span & CaptureEntity)[];
  /** #algo e @algo sem casamento (ficam no nome) */
  unmatchedProjects: string[];
  unmatchedPeople: string[];
  /** Horas escritas no texto: não são salvas e ficam no nome */
  times: Span[];
}

export const PRIORITY_BY_TOKEN: Record<string, TaskPriority> = {
  p1: 'urgent',
  p2: 'high',
  p3: 'medium',
  p4: 'low',
};

export const DEFAULT_PRIORITY: TaskPriority = 'medium';

interface Mention {
  start: number;
  end: number;
  entity: CaptureEntity;
}

/** Candidatos de nome: completo e, para pessoas, primeiro nome único */
function candidates(entities: CaptureEntity[], firstNames: boolean) {
  const list = entities
    .map(e => ({ entity: e, folded: fold(e.name.trim()) }))
    .filter(c => c.folded.length > 0);
  if (firstNames) {
    const counts = new Map<string, number>();
    for (const c of list) {
      const first = c.folded.split(/\s+/)[0];
      counts.set(first, (counts.get(first) ?? 0) + 1);
    }
    for (const c of [...list]) {
      const first = c.folded.split(/\s+/)[0];
      if (first !== c.folded && counts.get(first) === 1) list.push({ entity: c.entity, folded: first });
    }
  }
  return list;
}

/** #nome / @nome: casamento mais longo; devolve também os sem casamento */
function findMentions(
  folded: string,
  original: string,
  marker: '#' | '@',
  entities: CaptureEntity[],
  firstNames: boolean,
  ignoredIds: string[] = [],
) {
  const options = candidates(entities, firstNames);
  const matched: Mention[] = [];
  const unmatched: string[] = [];

  for (let i = folded.indexOf(marker); i !== -1; i = folded.indexOf(marker, i + 1)) {
    // # ou @ no começo de uma palavra (evita e-mails e "C#")
    if (i > 0 && !/\s/.test(folded[i - 1])) continue;
    const rest = folded.slice(i + 1);
    let best: { len: number; entity: CaptureEntity } | null = null;
    for (const o of options) {
      if (!rest.startsWith(o.folded) || isWordChar(rest[o.folded.length])) continue;
      if (!best || o.folded.length > best.len) best = { len: o.folded.length, entity: o.entity };
    }
    if (best && !ignoredIds.includes(best.entity.id)) {
      matched.push({ start: i, end: i + 1 + best.len, entity: best.entity });
    } else if (!best) {
      const word = original.slice(i).match(/^.[^\s#@]*/)?.[0] ?? marker;
      if (word.length > 1) unmatched.push(word);
    }
  }
  return { matched, unmatched };
}

const PRIORITY_RE = /p[1-4]/g;
const WAITING_RE = /(^|\s)aguardando\s+/g;
const WAITING_TEXT_MAX = 120;

/** Primeiro "aguardando <quem>" do texto */
function findWaiting(folded: string, original: string, people: CaptureEntity[]): ParsedWaiting | null {
  WAITING_RE.lastIndex = 0;
  const m = WAITING_RE.exec(folded);
  if (!m) return null;
  const start = m.index + m[1].length;
  let at = m.index + m[0].length;
  const make = (end: number, person: CaptureEntity | null, onText: string | null): ParsedWaiting =>
    ({ start, end, text: original.slice(start, end), person, onText });

  const withAt = folded[at] === '@';
  if (withAt) at += 1;
  // Pessoa cadastrada: nome mais longo (ou primeiro nome único), com ou sem @
  const rest = folded.slice(at);
  let best: { len: number; entity: CaptureEntity } | null = null;
  for (const o of candidates(people, true)) {
    if (!rest.startsWith(o.folded) || isWordChar(rest[o.folded.length])) continue;
    if (!best || o.folded.length > best.len) best = { len: o.folded.length, entity: o.entity };
  }
  if (best) return make(at + best.len, best.entity, null);

  // Várias palavras entre aspas
  const quote = withAt ? null : /^["“]([^"”]{1,200})["”]/.exec(original.slice(at));
  if (quote) {
    const onText = quote[1].trim().slice(0, WAITING_TEXT_MAX);
    return onText ? make(at + quote[0].length, null, onText) : null;
  }
  // Uma palavra
  const word = /^[\p{L}\p{N}][\p{L}\p{N}._-]*/u.exec(original.slice(at));
  if (!word) return null;
  return make(at + word[0].length, null, word[0].slice(0, WAITING_TEXT_MAX));
}
// "~" no começo de palavra seguido do valor ("~30m", "~1h30", "~2h")
const ESTIMATE_RE = /(^|\s)~(\d(?:[\d.,:hmin]*[\dhmin])?)(?![\p{L}\p{N}])/gu;

export function parseQuickCapture(input: string, ctx: ParseContext): ParsedCapture {
  const ignore = ctx.ignore ?? {};
  const removed: { start: number; end: number }[] = [];
  let folded = fold(input);

  // 0. "aguardando ..." (antes das menções: o @ dele não vira responsável)
  const waiting = ignore.waiting ? null : findWaiting(folded, input, ctx.people);
  if (waiting) {
    removed.push(waiting);
    folded = mask(folded, waiting.start, waiting.end);
  }

  // 1. #projeto (vale o último) e @pessoas
  const projects = findMentions(folded, input, '#', ctx.projects, false, ignore.projectIds);
  const people = findMentions(folded, input, '@', ctx.people, true, ignore.personIds);

  const lastProject = projects.matched[projects.matched.length - 1] ?? null;
  const project = lastProject
    ? { start: lastProject.start, end: lastProject.end, text: input.slice(lastProject.start, lastProject.end), ...lastProject.entity }
    : null;
  if (lastProject) removed.push(lastProject);
  for (const m of projects.matched) folded = mask(folded, m.start, m.end);

  const seen = new Set<string>();
  const parsedPeople: ParsedCapture['people'] = [];
  for (const m of people.matched) {
    folded = mask(folded, m.start, m.end);
    removed.push(m);
    if (seen.has(m.entity.id)) continue;
    seen.add(m.entity.id);
    parsedPeople.push({ start: m.start, end: m.end, text: input.slice(m.start, m.end), ...m.entity });
  }

  // 2. Prioridade (vale a última)
  let priority: ParsedCapture['priority'] = null;
  PRIORITY_RE.lastIndex = 0;
  let pm: RegExpExecArray | null;
  while ((pm = PRIORITY_RE.exec(folded))) {
    const start = pm.index;
    const end = start + 2;
    if (isWordChar(folded[start - 1]) || isWordChar(folded[end])) continue;
    if (ignore.priorities?.includes(pm[0])) continue;
    priority = { start, end, text: input.slice(start, end), value: PRIORITY_BY_TOKEN[pm[0]], key: pm[0] };
  }
  if (priority) {
    removed.push(priority);
    folded = mask(folded, priority.start, priority.end);
  }

  // 3. Estimativa "~30m" (vale a última). Antes das datas e horas, para "~2h"
  // não virar hora.
  let estimate: ParsedEstimate | null = null;
  ESTIMATE_RE.lastIndex = 0;
  let em: RegExpExecArray | null;
  while ((em = ESTIMATE_RE.exec(folded))) {
    const start = em.index + em[1].length;
    const end = start + 1 + em[2].length;
    const minutes = parseEstimate(em[2]);
    const key = em[2];
    if (minutes === null || ignore.estimates?.includes(key)) continue;
    estimate = { start, end, text: input.slice(start, end), minutes, key };
  }
  if (estimate) {
    removed.push(estimate);
    folded = mask(folded, estimate.start, estimate.end);
  }

  // 4. Datas: a última planejada e o último prazo não removidos. Usa o texto
  // mascarado para não achar data dentro de nome de projeto ou pessoa.
  const maskedOriginal = [...removed].reduce((text, s) => mask(text, s.start, s.end), input);
  const toParsed = (d: ReturnType<typeof findDates>[number]): ParsedDate => ({
    start: d.start, end: d.end, text: input.slice(d.start, d.end), iso: d.iso, kind: d.kind, key: `${d.kind}:${d.key}`,
  });
  const dates = findDates(maskedOriginal, ctx.today).map(toParsed).filter(d => !ignore.dates?.includes(d.key));
  const lastOf = (kind: DateKind) => [...dates].reverse().find(d => d.kind === kind) ?? null;
  const planned = lastOf('planned');
  const due = lastOf('due');
  if (planned) removed.push(planned);
  if (due) removed.push(due);

  // 5. Horas (só aviso; ficam no nome)
  const dateFree = [planned, due].reduce((text, d) => (d ? mask(text, d.start, d.end) : text), maskedOriginal);
  const times = findTimes(dateFree).map(t => ({ ...t, text: input.slice(t.start, t.end) }));

  return {
    name: removeSpans(input, removed),
    planned,
    due,
    estimate,
    waiting,
    priority,
    project,
    people: parsedPeople,
    unmatchedProjects: projects.unmatched,
    unmatchedPeople: people.unmatched,
    times,
  };
}

/** Termo de autocompletar: o #/@ antes do cursor, se o cursor está nele */
export function mentionAtCursor(input: string, cursor: number): { marker: '#' | '@'; start: number; query: string } | null {
  const before = input.slice(0, cursor);
  const hash = before.lastIndexOf('#');
  const at = before.lastIndexOf('@');
  const start = Math.max(hash, at);
  if (start === -1) return null;
  if (start > 0 && !/\s/.test(before[start - 1])) return null;
  const query = before.slice(start + 1);
  // Até 3 palavras depois do marcador (nomes com espaço)
  if (query.length > 60 || query.split(/\s+/).length > 4 || /[\n#@]/.test(query)) return null;
  return { marker: before[start] as '#' | '@', start, query };
}

/** Filtro do autocompletar: ignora maiúsculas e acentos; prefixo antes de trecho */
export function filterEntities<T extends CaptureEntity>(entities: T[], query: string, limit = 8): T[] {
  const q = fold(query.trim());
  const scored = entities
    .map(e => ({ e, n: fold(e.name) }))
    .filter(x => !q || x.n.includes(q))
    .sort((a, b) => Number(!a.n.startsWith(q)) - Number(!b.n.startsWith(q)) || a.n.localeCompare(b.n));
  return scored.slice(0, limit).map(x => x.e);
}
