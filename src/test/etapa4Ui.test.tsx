// Etapa 4: telas. Limpar campos grava null (item 5), escolher Aguardando pede de
// quem e a data (item 1) e o workspace da pessoa (item 4).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { DateEditCell, ResponsibleEditCell, StatusEditCell } from "@/components/tasks/InlineTaskFieldEdit";
import { WaitingDialog } from "@/components/planning/WaitingDialog";
import { TaskFormModal } from "@/components/modals/TaskFormModal";
import { PersonFormModal } from "@/components/modals/PersonFormModal";
import { personToDb, taskToDb } from "@/lib/dbMappers";
import { addBusinessDaysISO, todayISO } from "@/lib/taskDates";
import type { Person, Task } from "@/lib/types";

const updateTask = vi.fn(async (_id: string, _u: Partial<Task>) => {});
const addTask = vi.fn();
const updatePerson = vi.fn(async (_id: string, _u: Partial<Person>) => {});
const addPerson = vi.fn();

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/supabase", () => ({ supabase: { functions: { invoke: vi.fn() }, storage: { from: vi.fn() } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/contexts/DataContext", () => ({
  useData: () => ({
    projects: [{ id: "p1", name: "Site", workspaceId: "w-corp", userId: "me", status: "active" }],
    allProjects: [{ id: "p1", name: "Site", workspaceId: "w-corp", userId: "me", status: "active" }],
    inboxProject: null,
    workspaces: [
      { id: "w-corp", name: "Corporativo", userId: "me" },
      { id: "w-pessoal", name: "Pessoal", userId: "me" },
      { id: "w-alheio", name: "Do Fulano", userId: "fulano" },
    ],
    activeWorkspaceId: "w-corp",
    people: [
      { id: "ana", name: "Ana", active: true, workspaceId: null, color: "#000", type: "internal" },
      { id: "bia", name: "Bia", active: true, workspaceId: "w-corp", color: "#000", type: "internal" },
      { id: "caio", name: "Caio", active: true, workspaceId: "w-pessoal", color: "#000", type: "internal" },
    ],
    getProjectMemberIds: () => [],
    updateTask, addTask, updatePerson, addPerson,
  }),
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView = vi.fn();
// Radix usa estes no jsdom
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

const TODAY = todayISO();

beforeEach(() => {
  updateTask.mockClear();
  updatePerson.mockClear();
});

describe("item 5: limpar grava null", () => {
  it("tabela: 'Limpar data' da Data Fim grava end_date = null", () => {
    const onSave = vi.fn();
    render(<DateEditCell value="2026-11-10" onSave={onSave} />);
    fireEvent.click(screen.getByText("10/11/26"));
    fireEvent.click(screen.getByText("Limpar data"));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(taskToDb({ endDate: onSave.mock.calls[0][0] })).toEqual({ end_date: null });
  });

  it("tabela: 'Limpar seleção' dos responsáveis grava null (e zera o campo antigo)", () => {
    const onSave = vi.fn();
    render(<ResponsibleEditCell responsibleIds={["ana"]} people={[{ id: "ana", name: "Ana", active: true, color: "#000", type: "internal" }]} onSave={onSave} />);
    fireEvent.click(screen.getByText("Ana"));
    fireEvent.click(screen.getByText("Limpar seleção"));
    expect(taskToDb({ responsibleIds: onSave.mock.calls[0][0] })).toEqual({ responsible_ids: null, responsible_id: null });
  });

  it("formulário: apagar Data Fim e descrição grava null", async () => {
    const task: Task = { id: "t1", name: "Tarefa", projectId: "p1", status: "pending", priority: "medium", updatedAt: "", endDate: "2026-11-20", description: "texto" };
    render(<TaskFormModal open onOpenChange={() => {}} task={task} />);
    fireEvent.change(screen.getByLabelText("Data Fim"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Atualizar" })); });
    expect(updateTask).toHaveBeenCalledTimes(1);
    const row = taskToDb(updateTask.mock.calls[0][1]);
    expect(row.end_date).toBeNull();
    expect(row.description).toBeNull();
  });

  it("pessoa: apagar o e-mail grava null; 'Todos os workspaces' grava workspace null", async () => {
    const person: Person = { id: "x", name: "Xis Parceiro", firstName: "Xis", lastName: "Parceiro", email: "x@x.com", type: "partner", color: "#3B82F6", active: true, workspaceId: "w-corp" };
    render(<PersonFormModal open onOpenChange={() => {}} person={person} />);
    fireEvent.change(screen.getByPlaceholderText("email@exemplo.com"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Workspace"), { target: { value: "all" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Atualizar" })); });
    const row = personToDb(updatePerson.mock.calls[0][1]);
    expect(row.email).toBeNull();
    expect(row.workspace_id).toBeNull();
  });
});

describe("item 1: Aguardando nas telas", () => {
  it("tabela: escolher 'Aguardando' abre o pedido de dados (não grava direto)", () => {
    const onSave = vi.fn();
    const onWaiting = vi.fn();
    render(<StatusEditCell status="pending" onSave={onSave} onWaiting={onWaiting} />);
    fireEvent.click(screen.getByText("Pendente"));
    fireEvent.click(screen.getByText("Aguardando"));
    expect(onWaiting).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("diálogo: data padrão em 3 dias úteis e 'de quem' obrigatório", () => {
    const onSubmit = vi.fn();
    render(<WaitingDialog open today={TODAY} people={[{ id: "ana", name: "Ana" }]} onOpenChange={() => {}} onSubmit={onSubmit} />);
    expect(screen.getByLabelText("Cobrar em")).toHaveValue(addBusinessDaysISO(TODAY, 3));
    fireEvent.click(screen.getByRole("button", { name: "Marcar como Aguardando" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Diga de quem");
    fireEvent.change(screen.getByLabelText("De quem (texto livre)"), { target: { value: "cliente" } });
    fireEvent.click(screen.getByRole("button", { name: "Marcar como Aguardando" }));
    expect(onSubmit).toHaveBeenCalledWith({ waitingOnPersonId: null, waitingOnText: "cliente", followUpDate: addBusinessDaysISO(TODAY, 3) });
  });

  it("diálogo: pessoa cadastrada", () => {
    const onSubmit = vi.fn();
    render(<WaitingDialog open today={TODAY} people={[{ id: "ana", name: "Ana" }]} onOpenChange={() => {}} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("De quem"), { target: { value: "ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Marcar como Aguardando" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ waitingOnPersonId: "ana", waitingOnText: null }));
  });

  it("formulário: Status 'Aguardando' pede de quem e grava com a data de cobrança", async () => {
    const task: Task = { id: "t2", name: "Contrato", projectId: "p1", status: "pending", priority: "medium", updatedAt: "" };
    render(<TaskFormModal open onOpenChange={() => {}} task={task} />);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "waiting" } });
    expect(screen.getByLabelText("Cobrar em")).toHaveValue(addBusinessDaysISO(TODAY, 3));
    // Só pessoas do workspace do projeto (Corporativo) + "todos os workspaces"
    const options = [...(screen.getByLabelText("Aguardando de quem") as HTMLSelectElement).options].map(o => o.text);
    expect(options).toEqual(["Outra (escrever abaixo)", "Ana", "Bia"]);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Atualizar" })); });
    expect(updateTask).not.toHaveBeenCalled();
    expect(screen.getByText("Diga de quem você está aguardando")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Aguardando de quem"), { target: { value: "bia" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Atualizar" })); });
    expect(updateTask).toHaveBeenCalledWith("t2", expect.objectContaining({
      status: "waiting", waitingOnPersonId: "bia", waitingOnText: null, followUpDate: addBusinessDaysISO(TODAY, 3),
    }));
  });
});

describe("item 4: workspace da pessoa", () => {
  it("pessoa nova vem com o workspace ativo; só lista os workspaces do próprio usuário", () => {
    render(<PersonFormModal open onOpenChange={() => {}} />);
    const select = screen.getByLabelText("Workspace") as HTMLSelectElement;
    expect(select.value).toBe("w-corp");
    expect([...select.options].map(o => o.text)).toEqual(["Todos os workspaces", "Corporativo", "Pessoal"]);
  });
});
