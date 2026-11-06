import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Today from "@/pages/Today";
import { addDaysISO, todayISO } from "@/lib/taskDates";
import { DEFAULT_PLANNING, type PlanningSettings } from "@/lib/planning";
import type { Task } from "@/lib/types";
import { readTodayScope, writeTodayScope } from "@/lib/todayScope";

const updateTask = vi.fn(async (_id: string, _u: Partial<Task>) => {});
const logAuditEvent = vi.fn();
let planning: PlanningSettings = { ...DEFAULT_PLANNING };

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/auditLog", () => ({ logAuditEvent: (...args: unknown[]) => logAuditEvent(...args) }));
vi.mock("@/components/layout/MainLayout", () => ({ MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/layout/Header", () => ({
  Header: ({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) => (
    <header><h1>{title}</h1><p>{subtitle}</p>{actions}</header>
  ),
}));
vi.mock("@/components/modals/TaskFormModal", () => ({ TaskFormModal: ({ task }: { task: Task }) => <div>formulário de {task.name}</div> }));
vi.mock("@/hooks/usePlanningSettings", () => ({
  usePlanningSettings: () => ({ settings: planning, saved: true, loading: false, save: vi.fn(), saving: false }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));

const TODAY = todayISO();
const YESTERDAY = addDaysISO(TODAY, -1);
const TOMORROW = addDaysISO(TODAY, 1);

let tasks: Task[] = [];
const task = (id: string, name: string, extra: Partial<Task> = {}): Task => ({
  id, name, projectId: "p-mine", status: "pending", priority: "medium",
  createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z", ...extra,
});

vi.mock("@/contexts/DataContext", () => ({
  useData: () => ({
    allTasks: tasks,
    allProjects: [
      { id: "p-mine", name: "Site novo", workspaceId: "w-corp", userId: "me", status: "active" },
      { id: "p-other", name: "Projeto do Fulano", workspaceId: "w-ext", userId: "fulano", status: "active" },
      { id: "p-idea", name: "Geladeira", workspaceId: "w-corp", userId: "me", status: "idea" },
    ],
    inboxProject: { id: "p-inbox", name: "Caixa de entrada", workspaceId: "w-pessoal", userId: "me", isInbox: true, status: "active" },
    workspaces: [
      { id: "w-corp", name: "Corporativo", color: "#ff0000" },
      { id: "w-pessoal", name: "Pessoal", color: "#00ff00" },
      { id: "w-ext", name: "Cliente", color: "#0000ff" },
    ],
    people: [
      { id: "person-me", name: "Eu Mesmo", authUserId: "me", active: true },
      { id: "person-x", name: "Xavier", active: true },
    ],
    loading: false,
    updateTask,
  }),
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView = vi.fn();

const press = async (key: string, opts: Partial<KeyboardEventInit> = {}) => {
  await act(async () => { fireEvent.keyDown(document.body, { key, ...opts }); });
};
const section = (key: string) => document.querySelector(`[data-section="${key}"]`) as HTMLElement | null;
const namesIn = (key: string) => {
  const el = section(key);
  return el ? [...el.querySelectorAll("li p:first-child")].map(p => p.textContent) : [];
};
const renderToday = () => render(<MemoryRouter><Today /></MemoryRouter>);

beforeEach(() => {
  updateTask.mockClear();
  logAuditEvent.mockClear();
  planning = { ...DEFAULT_PLANNING, mon: 360, tue: 360, wed: 360, thu: 360, fri: 360, sat: 360, sun: 360 };
  writeTodayScope("me", "all");
  tasks = [
    task("t-plan-a", "planejada A", { plannedDate: TODAY, estimateMinutes: 120, todayOrder: 1000 }),
    task("t-plan-b", "planejada B", { plannedDate: TODAY, estimateMinutes: 90, todayOrder: 2000 }),
    task("t-plan-c", "planejada sem estimativa", { plannedDate: TODAY, todayOrder: 3000, projectId: "p-inbox" }),
    task("t-late-plan", "atrasada pelo plano", { plannedDate: YESTERDAY }),
    task("t-late-due", "atrasada pelo prazo", { endDate: YESTERDAY }),
    task("t-replanned", "prazo vencido replanejada", { endDate: YESTERDAY, plannedDate: TOMORROW }),
    task("t-due", "vence hoje", { endDate: TODAY }),
    task("t-done", "concluída hoje", { status: "completed", completedAt: new Date().toISOString(), plannedDate: TODAY }),
    task("t-other-mine", "do Fulano comigo", { projectId: "p-other", plannedDate: TODAY, responsibleIds: ["person-me"] }),
    task("t-other-not", "do Fulano sem mim", { projectId: "p-other", plannedDate: TODAY, responsibleIds: ["person-x"] }),
    task("t-mine-x", "minha do Xavier", { plannedDate: YESTERDAY, responsibleIds: ["person-x"] }),
    task("t-wait", "aguardando o Xavier", { status: "waiting", followUpDate: YESTERDAY, waitingOnPersonId: "person-x", plannedDate: TODAY }),
    task("t-wait-later", "aguardando depois", { status: "waiting", followUpDate: TOMORROW, endDate: YESTERDAY }),
    task("t-idea", "tarefa na geladeira", { projectId: "p-idea", plannedDate: TODAY }),
  ];
});

describe("página Hoje", () => {
  it("seções com precedência e sem repetição", () => {
    renderToday();
    expect(namesIn("planned")).toEqual(["planejada A", "planejada B", "planejada sem estimativa", "do Fulano comigo"]);
    expect(namesIn("overdue")).toEqual(expect.arrayContaining(["atrasada pelo plano", "atrasada pelo prazo", "minha do Xavier"]));
    expect(namesIn("overdue")).toHaveLength(3);
    expect(namesIn("dueToday")).toEqual(["vence hoje"]);
    // D4: replanejada para amanhã some de hoje; projeto alheio sem mim não entra
    expect(screen.queryByText("prazo vencido replanejada")).toBeNull();
    expect(screen.queryByText("do Fulano sem mim")).toBeNull();
    // Concluídas: recolhida por padrão
    expect(screen.queryByText("concluída hoje")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Concluídas hoje/ }));
    expect(screen.getByText("concluída hoje")).toBeInTheDocument();
    // Aguardando: só na seção de cobranças, e só quando a cobrança chegou
    expect(namesIn("waiting")).toEqual(["aguardando o Xavier"]);
    expect(screen.queryByText("aguardando depois")).toBeNull();
    // Projeto em Ideia fica fora
    expect(screen.queryByText("tarefa na geladeira")).toBeNull();
  });

  it("cada item mostra workspace e projeto (inclusive Caixa de entrada)", () => {
    renderToday();
    const row = screen.getByText("planejada sem estimativa").closest("li")!;
    expect(row.textContent).toContain("Pessoal · Caixa de entrada");
    expect(screen.getByText("planejada A").closest("li")!.textContent).toContain("Corporativo · Site novo");
  });

  it("barra de capacidade: soma das planejadas, sem estimativa e excesso", () => {
    planning = { ...planning, [weekdayKey()]: 180 };
    renderToday();
    const bar = screen.getByRole("region", { name: "Capacidade do dia" });
    expect(bar.textContent).toContain("3h 30m de 3h");
    expect(bar.dataset.level).toBe("over");
    expect(bar.textContent).toContain("Você planejou mais do que cabe no dia");
    expect(bar.textContent).toContain("2 sem estimativa");
  });

  it("capacidade entre 80% e 100% = alerta; abaixo de 80% = neutra", () => {
    planning = { ...planning, [weekdayKey()]: 240 };
    const { unmount } = renderToday();
    expect(screen.getByRole("region", { name: "Capacidade do dia" }).dataset.level).toBe("warning");
    unmount();
    planning = { ...planning, [weekdayKey()]: 600 };
    renderToday();
    expect(screen.getByRole("region", { name: "Capacidade do dia" }).dataset.level).toBe("ok");
  });

  it("capacidade 0: 'Dia sem capacidade configurada' com link para Configurações", () => {
    planning = { ...planning, [weekdayKey()]: 0 };
    renderToday();
    expect(screen.getByText(/Dia sem capacidade configurada/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configurar a capacidade" })).toHaveAttribute("href", "/settings?tab=planning");
  });

  it("filtro 'Só as minhas' esconde as dos outros nos meus projetos e fica salvo", () => {
    renderToday();
    expect(screen.getByText("minha do Xavier")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Só as minhas" }));
    expect(screen.queryByText("minha do Xavier")).toBeNull();
    expect(screen.getByText("do Fulano comigo")).toBeInTheDocument();
    // Salvo por usuário (localStorage; sem storage, fica em memória)
    expect(readTodayScope("me")).toBe("mine");
    expect(readTodayScope("outro-usuario")).toBe("all");
  });

  it("teclado: x conclui, t manda para amanhã, h puxa para hoje", async () => {
    renderToday();
    // primeira selecionada = primeira das atrasadas
    const first = namesIn("overdue")[0]!;
    const firstId = tasks.find(t => t.name === first)!.id;
    await press("x");
    expect(updateTask).toHaveBeenCalledWith(firstId, { status: "completed" });
    await press("t");
    expect(updateTask).toHaveBeenLastCalledWith(firstId, { plannedDate: TOMORROW, todayOrder: null });
    await press("h");
    expect(updateTask).toHaveBeenLastCalledWith(firstId, { plannedDate: TODAY, todayOrder: 4000 });
  });

  it("Alt+↓ reordena dentro de Planejadas (grava today_order)", async () => {
    renderToday();
    fireEvent.click(screen.getByText("planejada A"));
    await press("ArrowDown", { altKey: true });
    expect(updateTask).toHaveBeenCalledWith("t-plan-a", { todayOrder: 2500 });
  });

  it("atalhos ignorados em campos de texto", async () => {
    renderToday();
    const input = document.createElement("input");
    document.body.appendChild(input);
    await act(async () => { fireEvent.keyDown(input, { key: "x" }); });
    expect(updateTask).not.toHaveBeenCalled();
    input.remove();
  });

  it("'tirar do dia' desativado para atraso por prazo, com a explicação", () => {
    renderToday();
    const row = screen.getByText("atrasada pelo prazo").closest("li")!;
    const button = within(row).getByRole("button", { name: /Tirar do dia/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Tirar do dia: o prazo já passou; mude o prazo");
    const planned = screen.getByText("planejada B").closest("li")!;
    fireEvent.click(within(planned).getByRole("button", { name: "Tirar do dia" }));
    expect(updateTask).toHaveBeenCalledWith("t-plan-b", { plannedDate: null, todayOrder: null });
  });

  it("arrastar de Atrasadas para Planejadas define planned_date = hoje", async () => {
    renderToday();
    const dataTransfer = { setData: vi.fn(), getData: () => "t-late-due", effectAllowed: "", dropEffect: "" };
    const row = screen.getByText("atrasada pelo prazo").closest("li")!;
    const target = screen.getByText("planejada B").closest("li")!;
    fireEvent.dragStart(row, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer, clientY: 0 });
    await act(async () => { fireEvent.drop(target, { dataTransfer }); });
    expect(updateTask).toHaveBeenCalledTimes(1);
    expect(updateTask).toHaveBeenCalledWith("t-late-due", { plannedDate: TODAY, todayOrder: 1500 });
  });

  it("estimativa inline na linha", async () => {
    renderToday();
    fireEvent.click(screen.getByRole("button", { name: "Estimativa: planejada sem estimativa" }));
    const input = screen.getByLabelText("Estimativa em horas e minutos");
    fireEvent.change(input, { target: { value: "45m" } });
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(updateTask).toHaveBeenCalledWith("t-plan-c", { estimateMinutes: 45 });
  });

  it("Fechar o dia: lote 'amanhã' e registro day_closed com as contagens", async () => {
    renderToday();
    fireEvent.click(screen.getByRole("button", { name: /Fechar o dia/ }));
    const dialog = screen.getByRole("dialog");
    // tira uma do dia (só as que podem)
    const row = within(dialog).getByText("planejada A").closest("li")!;
    fireEvent.click(within(row).getByRole("radio", { name: "Tirar do dia" }));
    const lateDue = within(dialog).getByText("atrasada pelo prazo").closest("li")!;
    expect(within(lateDue).getByRole("radio", { name: "Tirar do dia" })).toBeDisabled();
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Fechar o dia" })); });
    // 4 planejadas + 3 atrasadas
    expect(updateTask).toHaveBeenCalledTimes(7);
    expect(updateTask).toHaveBeenCalledWith("t-plan-a", { plannedDate: null, todayOrder: null });
    expect(updateTask).toHaveBeenCalledWith("t-late-due", { plannedDate: TOMORROW, todayOrder: null });
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "day_closed",
      metadata: { date: TODAY, completed: 1, postponed: 6, removed: 1 },
    }));
  });

  it("Fechar o dia: 'tirar todas do dia' pula as com prazo vencido", async () => {
    renderToday();
    fireEvent.click(screen.getByRole("button", { name: /Fechar o dia/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Tirar todas do dia" }));
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Fechar o dia" })); });
    expect(updateTask).toHaveBeenCalledWith("t-late-due", { plannedDate: TOMORROW, todayOrder: null });
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ metadata: { date: TODAY, completed: 1, postponed: 1, removed: 6 } }));
  });

  it("Adicionar ao dia: busca sem acento e planeja para hoje", async () => {
    tasks.push(task("t-free", "Revisão do orçamento"));
    renderToday();
    await press("a");
    fireEvent.change(screen.getByPlaceholderText(/Adicionar ao dia/), { target: { value: "revisao orcamento" } });
    await act(async () => { fireEvent.click(screen.getByText("Revisão do orçamento")); });
    expect(updateTask).toHaveBeenCalledWith("t-free", { plannedDate: TODAY, todayOrder: 4000 });
  });
});

describe("página Hoje: Aguardando (Etapa 4)", () => {
  it("linha mostra de quem e o atraso da cobrança", () => {
    renderToday();
    const row = screen.getByText("aguardando o Xavier").closest("li")!;
    expect(row.textContent).toContain("Aguardando Xavier · cobrança atrasada há 1 dia");
  });

  it("v (voltou) devolve para Pendente; w cobra de novo com nova data", async () => {
    renderToday();
    fireEvent.click(screen.getByText("aguardando o Xavier"));
    await press("v");
    expect(updateTask).toHaveBeenCalledWith("t-wait", { status: "pending" });
    await press("w");
    const dialog = screen.getByRole("dialog");
    expect((within(dialog).getByLabelText("De quem") as HTMLSelectElement).value).toBe("person-x");
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Cobrar de novo" })); });
    expect(updateTask).toHaveBeenLastCalledWith("t-wait", expect.objectContaining({ status: "waiting", waitingOnPersonId: "person-x" }));
  });

  it("w numa tarefa comum marca como Aguardando", async () => {
    renderToday();
    fireEvent.click(screen.getByText("planejada B"));
    await press("w");
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("De quem (texto livre)"), { target: { value: "financeiro" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Marcar como Aguardando" })); });
    expect(updateTask).toHaveBeenCalledWith("t-plan-b", expect.objectContaining({ status: "waiting", waitingOnText: "financeiro" }));
  });

  it("t, d e h não valem para Aguardando", async () => {
    renderToday();
    fireEvent.click(screen.getByText("aguardando o Xavier"));
    await press("t");
    await press("h");
    expect(updateTask).not.toHaveBeenCalled();
  });
});

function weekdayKey(): keyof PlanningSettings {
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[new Date().getDay()];
}
