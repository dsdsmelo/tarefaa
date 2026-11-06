import { describe, expect, it } from "vitest";
import { addBusinessDaysISO } from "@/lib/taskDates";
import { defaultFollowUpDate, validateWaiting, waitingOnLabel, waitingUpdates } from "@/lib/waiting";
import { peopleForWorkspace } from "@/lib/people";
import { computeProjectHealth } from "@/lib/projectHealth";
import type { Milestone, Project, Task } from "@/lib/types";

describe("Aguardando", () => {
  it("3 dias úteis pulam o fim de semana", () => {
    expect(addBusinessDaysISO("2026-11-04", 3)).toBe("2026-11-09"); // qua -> seg
    expect(addBusinessDaysISO("2026-11-06", 3)).toBe("2026-11-11"); // sex -> qua
    expect(addBusinessDaysISO("2026-11-07", 1)).toBe("2026-11-09"); // sáb -> seg
    expect(defaultFollowUpDate("2026-11-02")).toBe("2026-11-05");   // seg -> qui
  });

  it("validação da tela: de quem e data obrigatórios", () => {
    expect(validateWaiting({ personId: null, text: "", followUpDate: "2026-11-10" })).toMatch(/de quem/);
    expect(validateWaiting({ personId: null, text: "x".repeat(121), followUpDate: "2026-11-10" })).toMatch(/120/);
    expect(validateWaiting({ personId: "p1", text: "", followUpDate: "" })).toMatch(/data/);
    expect(validateWaiting({ personId: null, text: "cliente", followUpDate: "2026-11-10" })).toBeNull();
  });

  it("um só 'de quem': pessoa vence o texto", () => {
    expect(waitingUpdates({ waitingOnPersonId: "p1", waitingOnText: "x", followUpDate: "2026-11-10" }))
      .toEqual({ status: "waiting", waitingOnPersonId: "p1", waitingOnText: null, followUpDate: "2026-11-10" });
    expect(waitingUpdates({ waitingOnPersonId: null, waitingOnText: "  cliente ", followUpDate: "2026-11-10" }).waitingOnText).toBe("cliente");
  });

  it("rótulo de quem", () => {
    const people = [{ id: "p1", name: "Maria" }];
    expect(waitingOnLabel({ waitingOnPersonId: "p1", waitingOnText: null }, people)).toBe("Maria");
    expect(waitingOnLabel({ waitingOnPersonId: "p9", waitingOnText: null }, people)).toBe("pessoa sem acesso");
    expect(waitingOnLabel({ waitingOnPersonId: null, waitingOnText: "cliente" }, people)).toBe("cliente");
  });
});

describe("Pessoas por workspace", () => {
  const people = [
    { id: "todos", active: true, workspaceId: null },
    { id: "corp", active: true, workspaceId: "w-corp" },
    { id: "pessoal", active: true, workspaceId: "w-pessoal" },
    { id: "inativa", active: false, workspaceId: null },
  ];
  it("workspace + 'todos os workspaces'; sem workspace, todas as ativas", () => {
    expect(peopleForWorkspace(people, "w-corp").map(p => p.id)).toEqual(["todos", "corp"]);
    expect(peopleForWorkspace(people, null).map(p => p.id)).toEqual(["todos", "corp", "pessoal"]);
  });
  it("quem já está selecionado (ou é membro) continua na lista", () => {
    expect(peopleForWorkspace(people, "w-corp", ["pessoal", "inativa"]).map(p => p.id)).toEqual(["todos", "corp", "pessoal", "inativa"]);
  });
});

describe("Saúde do projeto", () => {
  const TODAY = "2026-11-06";
  const project = (extra: Partial<Project> = {}): Project => ({ id: "p", name: "P", workspaceId: "w", status: "active", ...extra });
  let n = 0;
  const task = (extra: Partial<Task> = {}): Task => ({
    id: `t${++n}`, name: `t${n}`, projectId: "p", status: "pending", priority: "medium",
    responsibleIds: ["x"], updatedAt: new Date(2026, 10, 5, 12).toISOString(), ...extra,
  });
  const ms = (extra: Partial<Milestone>): Milestone => ({ id: `m${++n}`, name: "Entrega", projectId: "p", date: "2026-11-20", completed: false, ...extra });
  const health = (p: Project, tasks: Task[], milestones: Milestone[] = []) => computeProjectHealth(p, tasks, milestones, TODAY);

  it("verde sem problemas", () => {
    expect(health(project(), [task()]).color).toBe("green");
  });

  it("vermelho: tarefa aberta vencida (inclusive Aguardando) ou marco vencido", () => {
    expect(health(project(), [task({ endDate: "2026-11-05" })]).color).toBe("red");
    expect(health(project(), [task({ endDate: "2026-11-05", status: "waiting" })]).color).toBe("red");
    expect(health(project(), [task({ endDate: "2026-11-05", status: "completed" })]).color).toBe("green");
    expect(health(project(), [task()], [ms({ date: "2026-11-01" })]).color).toBe("red");
    expect(health(project(), [task()], [ms({ date: "2026-11-01", completed: true })]).color).toBe("green");
  });

  it("amarelo: marco em até 7 dias com pendências (da fase, ou do projeto se não tiver fase)", () => {
    expect(health(project(), [task()], [ms({ date: "2026-11-13" })]).color).toBe("yellow");
    expect(health(project(), [task()], [ms({ date: "2026-11-14" })]).color).toBe("green");
    expect(health(project(), [task({ phaseId: "f2" })], [ms({ date: "2026-11-10", phaseId: "f1" })]).color).toBe("green");
    expect(health(project(), [task({ phaseId: "f1" })], [ms({ date: "2026-11-10", phaseId: "f1" })]).color).toBe("yellow");
  });

  it("amarelo: mais de 30% das abertas sem responsável", () => {
    expect(health(project(), [task({ responsibleIds: [] }), task(), task()]).color).toBe("yellow");   // 33%
    expect(health(project(), [task({ responsibleIds: [] }), task(), task(), task()]).color).toBe("green"); // 25%
  });

  it("sem semáforo em Ideia, Concluído e Cancelado", () => {
    for (const status of ["idea", "completed", "cancelled"] as const) {
      expect(health(project({ status }), [task({ endDate: "2026-11-01" })]).color).toBeNull();
    }
  });

  it("ajuste manual: vale no lugar do calculado; 'revise' a partir de 14 dias", () => {
    const recent = health(project({ healthOverride: "green", healthOverrideAt: new Date(2026, 10, 1, 12).toISOString() }), [task({ endDate: "2026-11-01" })]);
    expect(recent).toMatchObject({ color: "green", calculated: "red", manual: true, manualDays: 5, reviewManual: false });
    const old = health(project({ healthOverride: "green", healthOverrideAt: new Date(2026, 9, 23, 12).toISOString() }), []);
    expect(old).toMatchObject({ manualDays: 14, reviewManual: true });
  });

  it("parado há X dias: passa de 7 dias sem atualização; sem tarefas não mostra", () => {
    expect(health(project(), [task({ updatedAt: new Date(2026, 9, 29, 12).toISOString() })]).staleDays).toBe(8);
    expect(health(project(), [task({ updatedAt: new Date(2026, 9, 30, 12).toISOString() })]).staleDays).toBeNull();
    expect(health(project(), []).staleDays).toBeNull();
  });

  it("próximo marco e próxima ação (concluída vira 'defina')", () => {
    const open = task();
    const done = task({ status: "completed" });
    const h = health(project({ nextActionTaskId: open.id }), [open, done], [ms({ date: "2026-11-25", name: "B" }), ms({ date: "2026-11-20", name: "A" })]);
    expect(h.nextMilestone?.name).toBe("A");
    expect(h.nextAction?.id).toBe(open.id);
    const h2 = health(project({ nextActionTaskId: done.id }), [open, done]);
    expect(h2).toMatchObject({ nextAction: null, nextActionDone: true });
  });
});
