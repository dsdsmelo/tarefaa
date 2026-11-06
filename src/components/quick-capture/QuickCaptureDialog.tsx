import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, CalendarCheck, CalendarDays, Clock, Flag, FolderKanban, Hourglass, Inbox, UserRound, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useData } from '@/contexts/DataContext';
import { cn } from '@/lib/utils';
import { priorityLabels } from '@/lib/types';
import { friendlyDbError } from '@/lib/dbErrors';
import { todayISO } from '@/lib/taskDates';
import {
  DEFAULT_PRIORITY,
  filterEntities,
  mentionAtCursor,
  parseQuickCapture,
  type CaptureEntity,
  type ParseIgnore,
} from '@/lib/quickCapture/parse';
import { formatShortDate } from '@/lib/quickCapture/format';
import { formatMinutes } from '@/lib/estimate';
import { peopleForWorkspace } from '@/lib/people';
import { defaultFollowUpDate, waitingUpdates } from '@/lib/waiting';

const CREATE_MORE_KEY = 'tarefaa.quick-capture.create-more';

const readCreateMore = () => {
  try { return window.localStorage.getItem(CREATE_MORE_KEY) === '1'; } catch { return false; }
};
const writeCreateMore = (value: boolean) => {
  try { window.localStorage.setItem(CREATE_MORE_KEY, value ? '1' : '0'); } catch { /* sem storage */ }
};

interface Suggestion extends CaptureEntity {
  hint?: string;
}

interface QuickCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickCaptureDialog({ open, onOpenChange }: QuickCaptureDialogProps) {
  const navigate = useNavigate();
  const { allProjects, people, workspaces, inboxProject, ensureInboxProject, addTask } = useData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [cursor, setCursor] = useState(0);
  const [ignore, setIgnore] = useState<ParseIgnore>({});
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [createMore, setCreateMore] = useState(readCreateMore);
  const [saving, setSaving] = useState(false);

  const today = todayISO();

  const workspaceName = (id: string) => workspaces.find(w => w.id === id)?.name;
  const projectEntities = useMemo<Suggestion[]>(
    () => allProjects
      .filter(p => p.status !== 'completed' && p.status !== 'cancelled')
      .map(p => ({ id: p.id, name: p.name, hint: workspaces.find(w => w.id === p.workspaceId)?.name })),
    [allProjects, workspaces]
  );
  // Pessoas: sem #projeto, todas (a Caixa de entrada atende todos os workspaces);
  // com #projeto, as do workspace dele + "todos os workspaces" (D11)
  const allPersonEntities = useMemo<Suggestion[]>(
    () => people.filter(p => p.active !== false).map(p => ({ id: p.id, name: p.name })),
    [people]
  );
  const firstPass = useMemo(
    () => parseQuickCapture(text, { today, projects: projectEntities, people: allPersonEntities, ignore }),
    [text, today, projectEntities, allPersonEntities, ignore]
  );
  const projectWorkspaceId = firstPass.project ? allProjects.find(p => p.id === firstPass.project!.id)?.workspaceId ?? null : null;
  const personEntities = useMemo<Suggestion[]>(
    () => projectWorkspaceId
      ? peopleForWorkspace(people, projectWorkspaceId).map(p => ({ id: p.id, name: p.name }))
      : allPersonEntities,
    [people, projectWorkspaceId, allPersonEntities]
  );
  const parsed = useMemo(
    () => (personEntities === allPersonEntities
      ? firstPass
      : parseQuickCapture(text, { today, projects: projectEntities, people: personEntities, ignore })),
    [firstPass, personEntities, allPersonEntities, text, today, projectEntities, ignore]
  );
  // Aguardando: a data simples da frase vira a data de cobrança (padrão: 3 dias úteis)
  const followUpDate = parsed.waiting ? (parsed.planned?.iso ?? defaultFollowUpDate(today)) : null;

  const parsedProjectWorkspace = parsed.project
    ? workspaceName(allProjects.find(p => p.id === parsed.project!.id)?.workspaceId ?? '')
    : undefined;

  // Autocompletar de #projeto e @pessoa no ponto do cursor
  const mention = mentionAtCursor(text, cursor);
  const suggestions = useMemo(() => {
    if (!mention || mention.start === dismissedAt) return [];
    const pool = mention.marker === '#' ? projectEntities : personEntities;
    const list = filterEntities(pool, mention.query);
    // Nome já completo seguido de espaço: não atrapalha o Enter
    const done = /\s$/.test(mention.query) && list.some(e => e.name.toLowerCase() === mention.query.trim().toLowerCase());
    return done ? [] : list;
  }, [mention, dismissedAt, projectEntities, personEntities]);

  useEffect(() => { setActiveSuggestion(0); }, [suggestions.length, mention?.start]);

  const reset = () => {
    setText('');
    setCursor(0);
    setIgnore({});
    setDismissedAt(null);
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const applySuggestion = (entity: Suggestion) => {
    if (!mention) return;
    const insert = `${mention.marker}${entity.name} `;
    const next = text.slice(0, mention.start) + insert + text.slice(cursor).replace(/^\s+/, '');
    const pos = mention.start + insert.length;
    setText(next);
    setCursor(pos);
    // O usuário escolheu: volta a reconhecer mesmo se antes tinha removido o chip
    setIgnore(prev => ({
      ...prev,
      projectIds: prev.projectIds?.filter(id => id !== entity.id),
      personIds: prev.personIds?.filter(id => id !== entity.id),
    }));
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(pos, pos));
  };

  const addIgnore = (key: Exclude<keyof ParseIgnore, 'waiting'>, value: string) =>
    setIgnore(prev => ({ ...prev, [key]: [...(prev[key] ?? []), value] }));

  const submit = async () => {
    const name = parsed.name.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      const projectId = parsed.project?.id ?? inboxProject?.id ?? (await ensureInboxProject());
      const task = await addTask(
        {
          name,
          projectId,
          status: 'pending',
          priority: parsed.priority?.value ?? DEFAULT_PRIORITY,
          // Data simples = planejada (planned_date); com marcador de prazo = end_date
          plannedDate: parsed.waiting ? undefined : parsed.planned?.iso,
          endDate: parsed.due?.iso,
          estimateMinutes: parsed.estimate?.minutes,
          ...(parsed.waiting
            ? waitingUpdates({ waitingOnPersonId: parsed.waiting.person?.id ?? null, waitingOnText: parsed.waiting.onText, followUpDate: followUpDate! })
            : {}),
          responsibleIds: parsed.people.length > 0 ? parsed.people.map(p => p.id) : undefined,
        },
        { source: 'quick_capture' }
      );
      const destination = parsed.project
        ? `${parsed.project.name}${parsedProjectWorkspace ? ` (${parsedProjectWorkspace})` : ''}`
        : 'Caixa de entrada';
      toast.success(`"${task.name}" criada em ${destination}`, {
        action: {
          label: 'Abrir',
          onClick: () => navigate(parsed.project ? `/projects/${projectId}?tab=tasks&tarefa=${task.id}` : '/inbox'),
        },
      });
      if (createMore) {
        reset();
        requestAnimationFrame(() => inputRef.current?.focus());
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Erro na captura rápida:', err);
      toast.error(friendlyDbError(err, 'Você não tem permissão para criar tarefa neste projeto.', 'Não foi possível criar a tarefa.'));
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSuggestion(i => (i + 1) % suggestions.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSuggestion(i => (i - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applySuggestion(suggestions[activeSuggestion]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDismissedAt(mention?.start ?? null); return; }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  };

  const syncCursor = () => setCursor(inputRef.current?.selectionStart ?? text.length);

  const hasText = text.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl gap-3 p-4 top-[20%] translate-y-0">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">Captura rápida</DialogTitle>
          <DialogDescription className="text-xs">
            Use <b>#projeto</b>, <b>@pessoa</b>, <b>p1</b> a <b>p4</b>, <b>~30m</b> para a estimativa, "sexta" para o dia planejado e "até sexta" para o prazo. Sem #projeto, vai para a Caixa de entrada.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <input
            ref={inputRef}
            autoFocus
            value={text}
            onChange={(e) => { setText(e.target.value); setCursor(e.target.selectionStart ?? e.target.value.length); setDismissedAt(null); }}
            onKeyDown={onKeyDown}
            onKeyUp={syncCursor}
            onClick={syncCursor}
            placeholder="ligar pro João amanhã p1 #Cliente X @Maria"
            aria-label="Texto da tarefa"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {suggestions.length > 0 && (
            <ul
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md"
              aria-label={mention?.marker === '#' ? 'Projetos' : 'Pessoas'}
            >
              {suggestions.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                      i === activeSuggestion ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                    )}
                  >
                    {mention?.marker === '#' ? <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" /> : <UserRound className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="truncate">{s.name}</span>
                    {s.hint && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{s.hint}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Prévia: o que foi reconhecido; × devolve o texto para o nome */}
        {hasText && (
          <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-sm">
            <p className="truncate">
              <span className="text-muted-foreground">Nome: </span>
              {parsed.name ? <span className="font-medium">{parsed.name}</span> : <span className="text-destructive">escreva o nome da tarefa</span>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {parsed.project ? (
                <Chip icon={FolderKanban} onRemove={() => addIgnore('projectIds', parsed.project!.id)} title="Remover: o texto volta para o nome e a tarefa vai para a Caixa de entrada">
                  {parsed.project.name}
                  {parsedProjectWorkspace && <span className="text-muted-foreground"> · {parsedProjectWorkspace}</span>}
                </Chip>
              ) : (
                <Chip icon={Inbox} muted>Caixa de entrada</Chip>
              )}
              {parsed.waiting && (
                <Chip icon={Hourglass} onRemove={() => setIgnore(prev => ({ ...prev, waiting: true }))} title={`Remover: "${parsed.waiting.text}" volta para o nome`}>
                  Aguardando {parsed.waiting.person?.name ?? parsed.waiting.onText}
                  <span className="text-muted-foreground"> · cobrar {formatShortDate(followUpDate!, today)}{parsed.planned ? '' : ' (padrão)'}</span>
                </Chip>
              )}
              {parsed.planned && !parsed.waiting && (
                <Chip icon={CalendarCheck} onRemove={() => addIgnore('dates', parsed.planned!.key)} title={`Remover: "${parsed.planned.text}" volta para o nome`}>
                  Planejado {formatShortDate(parsed.planned.iso, today)}
                  <span className="text-muted-foreground"> · "{parsed.planned.text}"</span>
                </Chip>
              )}
              {parsed.due && (
                <Chip icon={CalendarDays} onRemove={() => addIgnore('dates', parsed.due!.key)} title={`Remover: "${parsed.due.text}" volta para o nome`}>
                  Prazo {formatShortDate(parsed.due.iso, today)}
                  <span className="text-muted-foreground"> · "{parsed.due.text}"</span>
                </Chip>
              )}
              {parsed.estimate && (
                <Chip icon={Hourglass} onRemove={() => addIgnore('estimates', parsed.estimate!.key)} title={`Remover: "${parsed.estimate.text}" volta para o nome`}>
                  Estimativa {formatMinutes(parsed.estimate.minutes)}
                </Chip>
              )}
              {parsed.priority ? (
                <Chip icon={Flag} onRemove={() => addIgnore('priorities', parsed.priority!.key)} title={`Remover: "${parsed.priority.text}" volta para o nome`}>
                  {priorityLabels[parsed.priority.value]}
                </Chip>
              ) : (
                <Chip icon={Flag} muted>{priorityLabels[DEFAULT_PRIORITY]} (padrão)</Chip>
              )}
              {parsed.people.map(person => (
                <Chip key={person.id} icon={UserRound} onRemove={() => addIgnore('personIds', person.id)} title="Remover: o texto volta para o nome">
                  {person.name}
                </Chip>
              ))}
            </div>
            {parsed.times.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Hora "{parsed.times.map(t => t.text).join('", "')}" não é salva: as datas guardam só o dia. Ela fica no nome.
              </p>
            )}
            {[...parsed.unmatchedProjects, ...parsed.unmatchedPeople].length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {[...parsed.unmatchedProjects, ...parsed.unmatchedPeople].join(', ')} não encontrado: fica no nome
                {parsed.unmatchedProjects.length > 0 && !parsed.project ? ' e a tarefa vai para a Caixa de entrada' : ''}.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="quick-capture-more"
              checked={createMore}
              onCheckedChange={(value) => { setCreateMore(value); writeCreateMore(value); }}
            />
            <Label htmlFor="quick-capture-more" className="text-xs font-normal text-muted-foreground">Criar mais</Label>
          </div>
          <Button size="sm" onClick={() => void submit()} disabled={!parsed.name || saving}>
            {saving ? 'Criando...' : 'Criar tarefa'} <kbd className="ml-1.5 text-[10px] opacity-70">Enter</kbd>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ChipProps {
  icon: typeof Inbox;
  children: React.ReactNode;
  onRemove?: () => void;
  muted?: boolean;
  title?: string;
}

function Chip({ icon: Icon, children, onRemove, muted, title }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
        muted ? 'border-dashed border-border text-muted-foreground' : 'border-primary/30 bg-primary/5 text-foreground'
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{children}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} title={title} aria-label={title} className="rounded-full p-0.5 hover:bg-muted">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
