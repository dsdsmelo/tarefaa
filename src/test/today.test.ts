import { describe, expect, it } from "vitest";
import {
  buildTodaySections,
  classifyForToday,
  isRelevantForToday,
  orderAtEnd,
  planReorder,
  summarize,
  type TodayContext,
} from "@/lib/today";
import { capacityFor, capacityLevel, DEFAULT_PLANNING, settingsFromRow, settingsToRow } from "@/lib/planning";
import type { Project, Task } from "@/lib/types";

// Hoje fixo: sexta-feira, 06/11/2026
const TODAY = "2026-11-06";
const ME = "user-me";

const projects: Project[] = [
  { id: "p-mine", name: "Meu projeto", workspaceId: "w1", userId: ME, status: "active" },
  { id: "p-inbox", name: "Caixa de entrada", workspaceId: "w1", userId: ME, isInbox: true, status: "active" },
  { id: "p-other", name: "Projeto do Fulano", workspaceId: "w9", userId: "user-fulano", status: "active" },
];
const projectsById = new Map(projects.map(p => [p.id, p]));

let seq = 0;
const task = (extra: Partial<Task> = {}): Task => ({
  id: `t${++seq}`, name: `tarefa ${seq}`, projectId: "p-mine", status: "pending", priority: "medium",
  createdAt: `2026-11-01T10:00:0${seq % 10}Z`, updatedAt: "2026-11-01T10:00:00Z", ...extra,
});

const ctx = (extra: Partial<TodayContext> = {}): TodayContext => ({
  today: TODAY, userId: ME, myPersonIds: new Set(["person-me"]), scope: "all", ...extra,
});

const sectionOf = (t: Task) => classifyForToday(t, TODAY)?.section ?? null;

describe("Hoje: seções e precedência", () => {
  it("planejada para hoje", () => {
    expect(sectionOf(task({ plannedDate: TODAY }))).toBe("planned");
  });

  it("atrasadas: planejada no passado ou prazo vencido", () => {
    expect(sectionOf(task({ plannedDate: "2026-11-05" }))).toBe("overdue");
    expect(sectionOf(task({ endDate: "2026-11-01" }))).toBe("overdue");
  });

  it("vencem hoje: prazo hoje e planejada em outro dia (ou sem)", () => {
    expect(sectionOf(task({ endDate: TODAY }))).toBe("dueToday");
    expect(sectionOf(task({ endDate: TODAY, plannedDate: "2026-11-10" }))).toBe("dueToday");
  });

  it("planejada hoje vence atrasada e vence-hoje (aparece uma vez só)", () => {
    const overdueDeadline = classifyForToday(task({ plannedDate: TODAY, endDate: "2026-11-01" }), TODAY);
    expect(overdueDeadline).toMatchObject({ section: "planned", dueOverdue: true, canClearPlan: false });
    expect(sectionOf(task({ plannedDate: TODAY, endDate: TODAY }))).toBe("planned");
  });

  it("planejada no passado e prazo hoje: atrasada", () => {
    expect(sectionOf(task({ plannedDate: "2026-11-05", endDate: TODAY }))).toBe("overdue");
  });

  it("D4: prazo vencido mas replanejada para o futuro sai de Atrasadas", () => {
    expect(sectionOf(task({ endDate: "2026-11-01", plannedDate: "2026-11-09" }))).toBeNull();
    // e volta no dia planejado, com o selo
    expect(classifyForToday(task({ endDate: "2026-11-01", plannedDate: "2026-11-09" }), "2026-11-09"))
      .toMatchObject({ section: "planned", dueOverdue: true });
  });

  it("D4: 'tirar do dia' desativado quando o atraso é pelo prazo", () => {
    expect(classifyForToday(task({ endDate: "2026-11-01" }), TODAY)?.canClearPlan).toBe(false);
    expect(classifyForToday(task({ plannedDate: "2026-11-05" }), TODAY)?.canClearPlan).toBe(true);
    expect(classifyForToday(task({ plannedDate: "2026-11-05", endDate: "2026-11-02" }), TODAY)?.canClearPlan).toBe(false);
  });

  it("sem datas ou só no futuro: fora da página", () => {
    expect(sectionOf(task())).toBeNull();
    expect(sectionOf(task({ plannedDate: "2026-11-07", endDate: "2026-11-20" }))).toBeNull();
  });

  it("concluídas: só as de hoje (dia local); canceladas nunca", () => {
    const localNoon = new Date(2026, 10, 6, 12, 0).toISOString();
    const yesterday = new Date(2026, 10, 5, 23, 59).toISOString();
    expect(sectionOf(task({ status: "completed", completedAt: localNoon, plannedDate: TODAY }))).toBe("done");
    expect(sectionOf(task({ status: "completed", completedAt: yesterday }))).toBeNull();
    expect(sectionOf(task({ status: "completed", completedAt: null, plannedDate: TODAY }))).toBeNull();
    expect(sectionOf(task({ status: "cancelled", plannedDate: TODAY }))).toBeNull();
  });

  it("'hoje' é a data local: 23h30 de hoje conta como hoje", () => {
    const lateTonight = new Date(2026, 10, 6, 23, 30).toISOString();
    expect(sectionOf(task({ status: "completed", completedAt: lateTonight }))).toBe("done");
  });
});

describe("Hoje: quais tarefas entram (D3) e filtro Só as minhas / Todas", () => {
  const mineNoOne = task({ plannedDate: TODAY });
  const mineMe = task({ plannedDate: TODAY, responsibleIds: ["person-me"] });
  const mineOther = task({ plannedDate: TODAY, responsibleIds: ["person-x"] });
  const inbox = task({ plannedDate: TODAY, projectId: "p-inbox" });
  const otherMe = task({ plannedDate: TODAY, projectId: "p-other", responsibleIds: ["person-me", "person-x"] });
  const otherNotMe = task({ plannedDate: TODAY, projectId: "p-other", responsibleIds: ["person-x"] });
  const otherNoOne = task({ plannedDate: TODAY, projectId: "p-other" });
  const rel = (t: Task, scope: "all" | "mine") => isRelevantForToday(t, projectsById.get(t.projectId), ctx({ scope }));

  it("Todas: todas as tarefas dos meus projetos e da Caixa de entrada", () => {
    expect([mineNoOne, mineMe, mineOther, inbox].map(t => rel(t, "all"))).toEqual([true, true, true, true]);
  });

  it("Só as minhas: nos meus projetos, sem responsável ou comigo", () => {
    expect([mineNoOne, mineMe, mineOther, inbox].map(t => rel(t, "mine"))).toEqual([true, true, false, true]);
  });

  it("projetos de outros: só quando sou responsável, nos dois modos", () => {
    for (const scope of ["all", "mine"] as const) {
      expect([otherMe, otherNotMe, otherNoOne].map(t => rel(t, scope))).toEqual([true, false, false]);
    }
  });

  it("projeto desconhecido ou sem usuário: fora", () => {
    expect(isRelevantForToday(task({ projectId: "p-??" }), undefined, ctx())).toBe(false);
    expect(isRelevantForToday(mineNoOne, projectsById.get("p-mine"), ctx({ userId: null }))).toBe(false);
  });

  it("buildTodaySections aplica as duas regras", () => {
    const s = buildTodaySections([mineNoOne, mineOther, otherMe, otherNotMe], projectsById, ctx({ scope: "mine" }));
    expect(s.planned.map(i => i.task.id)).toEqual([mineNoOne.id, otherMe.id]);
  });
});

describe("Hoje: ordem, resumo e capacidade", () => {
  it("planejadas: ordem manual primeiro, depois prioridade", () => {
    const a = task({ plannedDate: TODAY, priority: "low", todayOrder: 2000 });
    const b = task({ plannedDate: TODAY, priority: "urgent" });
    const c = task({ plannedDate: TODAY, priority: "high", todayOrder: 1000 });
    const d = task({ plannedDate: TODAY, priority: "low" });
    const s = buildTodaySections([a, b, c, d], projectsById, ctx());
    expect(s.planned.map(i => i.task.id)).toEqual([c.id, a.id, b.id, d.id]);
  });

  it("resumo: planejadas + atrasadas, minutos e sem estimativa", () => {
    const s = buildTodaySections([
      task({ plannedDate: TODAY, estimateMinutes: 90 }),
      task({ plannedDate: TODAY, estimateMinutes: 30 }),
      task({ plannedDate: TODAY }),
      task({ endDate: "2026-11-01", estimateMinutes: 600 }),
      task({ endDate: TODAY }),
    ], projectsById, ctx());
    expect(summarize(s)).toEqual({ count: 4, plannedMinutes: 120, missingEstimate: 1 });
  });

  it("seção 'Aguardando cobrança hoje' existe e fica vazia (Etapa 4)", () => {
    const s = buildTodaySections([task({ plannedDate: TODAY })], projectsById, ctx());
    expect(s.waiting).toEqual([]);
  });

  it("capacidade por dia da semana e níveis", () => {
    expect(capacityFor(DEFAULT_PLANNING, "2026-11-06")).toBe(360); // sexta
    expect(capacityFor(DEFAULT_PLANNING, "2026-11-07")).toBe(0);   // sábado
    expect(capacityFor({ ...DEFAULT_PLANNING, sun: 120 }, "2026-11-08")).toBe(120);
    expect(capacityLevel(287, 360)).toBe("ok");
    expect(capacityLevel(288, 360)).toBe("warning");
    expect(capacityLevel(360, 360)).toBe("warning");
    expect(capacityLevel(361, 360)).toBe("over");
    expect(capacityLevel(0, 0)).toBe("none");
  });

  it("linha do banco <-> configuração", () => {
    expect(settingsFromRow(null)).toEqual(DEFAULT_PLANNING);
    const row = settingsToRow({ ...DEFAULT_PLANNING, mon: 480 });
    expect(row).toMatchObject({ mon_minutes: 480, sat_minutes: 0 });
    expect(settingsFromRow(row).mon).toBe(480);
  });
});

describe("Hoje: reordenar (today_order)", () => {
  const t = (id: string, todayOrder: number | null) => task({ id, todayOrder, plannedDate: TODAY });

  it("entre dois vizinhos com ordem: grava só a movida, no meio", () => {
    const list = [t("a", 1000), t("b", 2000), t("c", 3000)];
    expect(planReorder(list, list[2], 1)).toEqual([{ id: "c", todayOrder: 1500 }]);
  });

  it("para o topo e para o fim", () => {
    const list = [t("a", 1000), t("b", 2000)];
    expect(planReorder(list, list[1], 0)).toEqual([{ id: "b", todayOrder: 0 }]);
    expect(planReorder(list, list[0], 5)).toEqual([{ id: "a", todayOrder: 3000 }]);
  });

  it("sem espaço entre os vizinhos: renumera, gravando só o que mudou", () => {
    const list = [t("a", 1000), t("b", 1001), t("c", 5000)];
    expect(planReorder(list, list[2], 1)).toEqual([
      { id: "c", todayOrder: 2000 },
      { id: "b", todayOrder: 3000 },
    ]);
  });

  it("lista ainda sem ordem manual: materializa a ordem vista", () => {
    const list = [t("a", null), t("b", null), t("c", null)];
    expect(planReorder(list, list[2], 0)).toEqual([
      { id: "c", todayOrder: 1000 }, { id: "a", todayOrder: 2000 }, { id: "b", todayOrder: 3000 },
    ]);
  });

  it("tarefa vinda de outra seção entra na posição solta", () => {
    const list = [t("a", 1000), t("b", 2000)];
    const incoming = task({ id: "x", endDate: "2026-11-01" });
    expect(planReorder(list, incoming, 1)).toEqual([{ id: "x", todayOrder: 1500 }]);
    expect(planReorder([], incoming, 0)).toEqual([{ id: "x", todayOrder: 1000 }]);
  });

  it("depois do último com ordem, antes dos sem ordem", () => {
    const list = [t("a", 1000), t("b", null)];
    const incoming = task({ id: "x" });
    expect(planReorder(list, incoming, 1)).toEqual([{ id: "x", todayOrder: 2000 }]);
  });

  it("orderAtEnd", () => {
    expect(orderAtEnd([t("a", 1000), t("b", null)])).toBe(2000);
    expect(orderAtEnd([t("a", null)])).toBeNull();
  });
});
