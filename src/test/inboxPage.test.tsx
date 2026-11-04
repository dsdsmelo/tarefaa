import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Inbox from "@/pages/Inbox";
import type { Task } from "@/lib/types";

const updateTask = vi.fn(async () => {});
const deleteTask = vi.fn(async () => {});
const addTask = vi.fn(async () => ({}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/layout/MainLayout", () => ({ MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/modals/TaskFormModal", () => ({ TaskFormModal: ({ task }: { task: Task }) => <div>formulário de {task.name}</div> }));

const task = (id: string, name: string, createdAt: string, extra: Partial<Task> = {}): Task => ({
  id, name, projectId: "p-inbox", status: "pending", priority: "medium", createdAt, updatedAt: createdAt, ...extra,
});

vi.mock("@/contexts/DataContext", () => ({
  useData: () => ({
    inboxProject: { id: "p-inbox", name: "Caixa de entrada", workspaceId: "w-pessoal", isInbox: true, status: "active" },
    inboxTasks: [
      task("t-old", "mais antiga", "2026-11-01T10:00:00Z"),
      task("t-new", "mais nova", "2026-11-03T10:00:00Z"),
      task("t-done", "já concluída", "2026-11-04T10:00:00Z", { status: "completed" }),
    ],
    allProjects: [
      { id: "p-cliente", name: "Cliente X", workspaceId: "w-corp", status: "active" },
      { id: "p-casa", name: "Reforma da casa", workspaceId: "w-pessoal", status: "active" },
    ],
    workspaces: [
      { id: "w-pessoal", name: "Pessoal" },
      { id: "w-corp", name: "Corporativo" },
    ],
    people: [{ id: "u-maria", name: "Maria Silva", active: true }],
    loading: false,
    updateTask, deleteTask, addTask,
  }),
}));

// jsdom não implementa estes (usados pelo cmdk)
Element.prototype.scrollIntoView = vi.fn();
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const press = async (key: string) => {
  await act(async () => { fireEvent.keyDown(document.body, { key }); });
};

beforeEach(() => {
  updateTask.mockClear();
  deleteTask.mockClear();
  addTask.mockClear();
});

const renderInbox = () => render(<MemoryRouter><Inbox /></MemoryRouter>);

describe("página Caixa de entrada", () => {
  it("lista só as abertas, das mais novas para as mais antigas", () => {
    renderInbox();
    const items = screen.getAllByRole("listitem").map(li => li.textContent);
    expect(items[0]).toContain("mais nova");
    expect(items[1]).toContain("mais antiga");
    expect(screen.queryByText("já concluída")).toBeNull();
  });

  it("x conclui a selecionada; j desce a seleção", async () => {
    renderInbox();
    await press("x");
    expect(updateTask).toHaveBeenCalledWith("t-new", { status: "completed" });
    await press("j");
    await press("x");
    expect(updateTask).toHaveBeenLastCalledWith("t-old", { status: "completed" });
  });

  it("1 a 4 mudam a prioridade", async () => {
    renderInbox();
    await press("1");
    expect(updateTask).toHaveBeenCalledWith("t-new", { priority: "urgent" });
    await press("4");
    expect(updateTask).toHaveBeenLastCalledWith("t-new", { priority: "low" });
  });

  it("Del exclui", async () => {
    renderInbox();
    await press("Delete");
    expect(deleteTask).toHaveBeenCalledWith("t-new");
  });

  it("m abre a busca de projetos (sem acento) e move", async () => {
    renderInbox();
    await press("m");
    const search = screen.getByPlaceholderText(/Mover "mais nova" para/);
    fireEvent.change(search, { target: { value: "reforma da casa" } });
    await act(async () => { fireEvent.click(screen.getByText("Reforma da casa")); });
    expect(updateTask).toHaveBeenCalledWith("t-new", { projectId: "p-casa" });
  });

  it("d define o prazo digitado em português", async () => {
    renderInbox();
    await press("d");
    const input = screen.getByLabelText("Prazo da tarefa");
    fireEvent.change(input, { target: { value: "dia 31" } });
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(updateTask).toHaveBeenCalledWith("t-new", { endDate: expect.stringMatching(/^\d{4}-\d{2}-31$/) });
  });

  it("Enter abre o formulário completo", async () => {
    renderInbox();
    await press("Enter");
    expect(screen.getByText("formulário de mais nova")).toBeInTheDocument();
  });

  it("? mostra os atalhos", async () => {
    renderInbox();
    await press("?");
    expect(screen.getByText("Atalhos da triagem")).toBeInTheDocument();
  });
});
