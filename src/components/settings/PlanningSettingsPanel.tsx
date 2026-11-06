import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePlanningSettings } from '@/hooks/usePlanningSettings';
import { formatMinutes } from '@/lib/estimate';
import { DEFAULT_PLANNING, MAX_DAY_CAPACITY, WEEKDAYS, type PlanningSettings, type WeekdayKey } from '@/lib/planning';
import { friendlyDbError } from '@/lib/dbErrors';

type Draft = Record<WeekdayKey, { h: string; m: string }>;

const toDraft = (s: PlanningSettings): Draft =>
  Object.fromEntries(WEEKDAYS.map(({ key }) => [key, { h: String(Math.floor(s[key] / 60)), m: String(s[key] % 60) }])) as Draft;

const toMinutes = (d: { h: string; m: string }): number | null => {
  const h = d.h.trim() === '' ? 0 : Number(d.h);
  const m = d.m.trim() === '' ? 0 : Number(d.m);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) return null;
  const total = h * 60 + m;
  return total <= MAX_DAY_CAPACITY ? total : null;
};

/** Capacidade por dia da semana (página Hoje): uma linha por dia, em horas e minutos */
export function PlanningSettingsPanel() {
  const { settings, loading, save, saving } = usePlanningSettings();
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));

  useEffect(() => { setDraft(toDraft(settings)); }, [settings]);

  const values = WEEKDAYS.map(({ key }) => [key, toMinutes(draft[key])] as const);
  const invalid = values.some(([, v]) => v === null);
  const weekTotal = values.reduce((sum, [, v]) => sum + (v ?? 0), 0);
  const dirty = values.some(([key, v]) => v !== settings[key]);

  const update = (key: WeekdayKey, field: 'h' | 'm', value: string) =>
    setDraft(prev => ({ ...prev, [key]: { ...prev[key], [field]: value.replace(/\D/g, '').slice(0, 4) } }));

  const submit = async () => {
    if (invalid) return;
    try {
      await save(Object.fromEntries(values) as PlanningSettings);
      toast.success('Capacidade salva');
    } catch (err) {
      console.error('Erro ao salvar capacidade:', err);
      toast.error(friendlyDbError(err, 'Você não tem permissão para esta alteração.', 'Não foi possível salvar a capacidade.'));
    }
  };

  return (
    <Panel
      icon={CalendarClock}
      title="Capacidade do dia"
      description="Quanto do dia você consegue planejar. A página Hoje compara a soma das estimativas com este valor."
      bodyClassName="p-5 space-y-4"
    >
      <div className="divide-y divide-border rounded-lg border border-border">
        {WEEKDAYS.map(({ key, label }) => {
          const minutes = toMinutes(draft[key]);
          return (
            <div key={key} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="w-20 text-sm font-medium">{label}</span>
              <div className="flex items-center gap-1.5">
                <Input
                  inputMode="numeric"
                  aria-label={`${label}: horas`}
                  className="h-8 w-16 text-right tabular-nums"
                  value={draft[key].h}
                  onChange={(e) => update(key, 'h', e.target.value)}
                  disabled={loading}
                />
                <span className="text-xs text-muted-foreground">h</span>
                <Input
                  inputMode="numeric"
                  aria-label={`${label}: minutos`}
                  className="h-8 w-16 text-right tabular-nums"
                  value={draft[key].m}
                  onChange={(e) => update(key, 'm', e.target.value)}
                  disabled={loading}
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
              <span className="ml-auto text-xs text-muted-foreground">
                {minutes === null ? <span className="text-destructive">até 24h, minutos de 0 a 59</span> : minutes === 0 ? 'sem capacidade' : formatMinutes(minutes)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Semana: {formatMinutes(weekTotal)}</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDraft(toDraft(DEFAULT_PLANNING))} disabled={saving}>
            Usar padrão (6h seg a sex)
          </Button>
          <Button size="sm" onClick={() => void submit()} disabled={invalid || !dirty || saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
