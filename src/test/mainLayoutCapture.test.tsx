// Correção 1 (Etapa 3): a captura rápida abre pelo botão da barra lateral com o
// layout REAL (MainLayout + AppSidebar + QuickCaptureProvider), sem simular o
// provider. Correção 2: ordem do menu Gestão.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuickCapture } from "@/components/quick-capture/context";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", email: "u1@teste.local", user_metadata: {} }, profile: null, signOut: vi.fn() }),
}));

vi.mock("@/contexts/DataContext", () => ({
  useData: () => ({
    workspaces: [{ id: "w-1", name: "Pessoal", kind: "personal", color: "#2563EB", isDefault: true }],
    activeWorkspace: { id: "w-1", name: "Pessoal", kind: "personal", color: "#2563EB", isDefault: true },
    setActiveWorkspace: vi.fn(),
    inboxTasks: [],
    allTasks: [],
    allProjects: [],
    inboxProject: { id: "p-inbox", name: "Caixa de entrada", workspaceId: "w-1", userId: "u-1", isInbox: true, status: "active" },
    people: [],
    addTask: vi.fn(),
    ensureInboxProject: vi.fn(async () => "p-inbox"),
  }),
}));

const renderLayout = () =>
  render(
    <MemoryRouter initialEntries={["/inbox"]}>
      <MainLayout><p>conteúdo da página</p></MainLayout>
    </MemoryRouter>
  );

describe("layout real: captura rápida e menu", () => {
  it("o botão 'Nova tarefa' da barra lateral abre a captura", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderLayout();
    expect(screen.queryByLabelText("Texto da tarefa")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Nova tarefa" }));
    expect(screen.getByLabelText("Texto da tarefa")).toBeInTheDocument();
    // Não caiu no fallback "fora do provider"
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("fora do QuickCaptureProvider"));
    warn.mockRestore();
  });

  it("Q também abre com o layout real", () => {
    renderLayout();
    fireEvent.keyDown(document.body, { key: "q" });
    expect(screen.getByLabelText("Texto da tarefa")).toBeInTheDocument();
  });

  it("menu Gestão: Dashboard, Hoje, Caixa de entrada, Projetos, Gantt", () => {
    renderLayout();
    const group = screen.getByText("Gestão").closest("[data-sidebar='group']") as HTMLElement;
    const labels = within(group).getAllByRole("link").map(a => a.textContent?.replace(/\d+$/, "").trim());
    expect(labels).toEqual(["Dashboard", "Hoje", "Caixa de entrada", "Projetos", "Gantt"]);
  });

  it("defeito antigo: hook chamado no corpo da página (acima do provider) não abre e avisa no console", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    function PageWithOwnButton() {
      const { openQuickCapture } = useQuickCapture(); // acima do MainLayout
      return <MainLayout><button onClick={openQuickCapture}>botão da página</button></MainLayout>;
    }
    render(<MemoryRouter><PageWithOwnButton /></MemoryRouter>);
    fireEvent.click(screen.getByText("botão da página"));
    expect(screen.queryByLabelText("Texto da tarefa")).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("fora do QuickCaptureProvider"));
    warn.mockRestore();
  });
});
