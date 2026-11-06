import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Projects from "@/pages/Projects";
import { addDaysISO, todayISO } from "@/lib/taskDates";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/layout/MainLayout", () => ({ MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header> }));
vi.mock("@/components/modals/ProjectFormModal", () => ({ ProjectFormModal: () => null, COVER_GRADIENTS: [], isHexColor: () => false }));

const TODAY = todayISO();
const recent = new Date().toISOString();

vi.mock("@/contexts/DataContext", () => ({
  useData: () => ({
    projects: [
      { id: "p-ativo", name: "Ativo em risco", workspaceId: "w", status: "active", nextActionTaskId: "t-next" },
      { id: "p-plan", name: "Planejando", workspaceId: "w", status: "planning", healthOverride: "yellow", healthOverrideAt: new Date(Date.now() - 20 * 86_400_000).toISOString() },
      { id: "p-ideia", name: "Ideia guardada", workspaceId: "w", status: "idea" },
      { id: "p-pausa", name: "Pausado", workspaceId: "w", status: "paused" },
    ],
    tasks: [
      { id: "t-late", name: "Atrasada", projectId: "p-ativo", status: "pending", priority: "medium", endDate: addDaysISO(TODAY, -2), responsibleIds: ["x"], updatedAt: recent },
      { id: "t-next", name: "Ligar para o cliente", projectId: "p-ativo", status: "pending", priority: "medium", responsibleIds: ["x"], updatedAt: recent },
      { id: "t-ideia", name: "Rascunho", projectId: "p-ideia", status: "pending", priority: "medium", endDate: addDaysISO(TODAY, -5), updatedAt: recent },
    ],
    phases: [],
    milestones: [{ id: "m1", name: "Go-live", projectId: "p-ativo", date: addDaysISO(TODAY, 10), completed: false }],
    deleteProject: vi.fn(),
    loading: false,
    error: null,
  }),
}));

const renderProjects = () => render(<MemoryRouter><Projects /></MemoryRouter>);

describe("página Projetos (Etapa 4)", () => {
  it("filtro padrão: só Planejamento e Ativo, com aviso dos ocultos", () => {
    renderProjects();
    expect(screen.getByText("Ativo em risco")).toBeInTheDocument();
    expect(screen.getByText("Planejando")).toBeInTheDocument();
    expect(screen.queryByText("Ideia guardada")).toBeNull();
    expect(screen.queryByText("Pausado")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ver todos \(2 em Ideia, pausados ou encerrados\)/ }));
    expect(screen.getByText("Ideia guardada")).toBeInTheDocument();
  });

  it("card: semáforo, próxima ação e próximo marco", () => {
    renderProjects();
    const card = screen.getByText("Ativo em risco").closest("div.group")!;
    expect(card.querySelector('[data-health="red"]')).not.toBeNull();
    expect(card.textContent).toContain("Próxima ação: Ligar para o cliente");
    expect(card.textContent).toContain("Próximo marco: Go-live");
  });

  it("ajuste manual antigo: 'manual há N dias' e 'Revise o status manual'", () => {
    renderProjects();
    const card = screen.getByText("Planejando").closest("div.group")!;
    expect(card.querySelector('[data-health="yellow"]')).not.toBeNull();
    expect(card.textContent).toContain("manual há 20 dias");
    expect(card.textContent).toContain("Revise o status manual");
  });

  it("Ideia não mostra semáforo", () => {
    renderProjects();
    fireEvent.click(screen.getByRole("button", { name: /Ver todos/ }));
    const card = screen.getByText("Ideia guardada").closest("div.group")!;
    expect(card.querySelector("[data-health]")).toBeNull();
  });
});
