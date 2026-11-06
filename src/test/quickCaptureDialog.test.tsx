import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QuickCaptureProvider } from "@/components/quick-capture/QuickCaptureProvider";
import { useQuickCapture } from "@/components/quick-capture/context";
import { addDays } from "@/lib/quickCapture/dates";
import { addBusinessDaysISO, todayISO } from "@/lib/taskDates";

const addTask = vi.fn();

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/contexts/DataContext", () => ({
  useData: () => ({
    allProjects: [
      { id: "p-cliente", name: "Cliente", workspaceId: "w-corp", status: "active" },
      { id: "p-cliente-x", name: "Cliente X", workspaceId: "w-corp", status: "active" },
    ],
    people: [
      { id: "u-maria", name: "Maria Silva", active: true },
      { id: "u-joao", name: "João Souza", active: true },
    ],
    workspaces: [
      { id: "w-pessoal", name: "Pessoal" },
      { id: "w-corp", name: "Corporativo" },
    ],
    inboxProject: { id: "p-inbox", name: "Caixa de entrada", workspaceId: "w-pessoal", isInbox: true },
    ensureInboxProject: vi.fn(async () => "p-inbox"),
    addTask,
  }),
}));

function OpenButton() {
  const { openQuickCapture } = useQuickCapture();
  return <button onClick={openQuickCapture}>abrir</button>;
}

const renderCapture = () =>
  render(
    <MemoryRouter>
      <QuickCaptureProvider>
        <OpenButton />
        <input aria-label="outro campo" />
      </QuickCaptureProvider>
    </MemoryRouter>
  );

const typeText = (text: string) => {
  const input = screen.getByLabelText("Texto da tarefa") as HTMLInputElement;
  fireEvent.change(input, { target: { value: text } });
  return input;
};

beforeEach(() => {
  addTask.mockReset();
  addTask.mockImplementation(async (task) => ({ ...task, id: "t-1", updatedAt: "" }));
});

describe("janela de captura rápida", () => {
  it("exemplo completo: autocompletar no Enter, depois cria com os campos reconhecidos", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("abrir"));
    const input = typeText("ligar pro João amanhã p1 #Cliente X @Maria");

    // Cursor logo depois de "@Maria": o primeiro Enter completa a pessoa
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("ligar pro João amanhã p1 #Cliente X @Maria Silva ");
    expect(addTask).not.toHaveBeenCalled();

    expect(screen.getByText("ligar pro João")).toBeInTheDocument();
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(addTask).toHaveBeenCalledWith(
      {
        name: "ligar pro João",
        projectId: "p-cliente-x",
        status: "pending",
        priority: "urgent",
        plannedDate: addDays(todayISO(), 1),
        endDate: undefined,
        estimateMinutes: undefined,
        responsibleIds: ["u-maria"],
      },
      { source: "quick_capture" }
    );
  });

  it("sem #projeto vai para a Caixa de entrada com prioridade média", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("abrir"));
    const input = typeText("comprar pão");
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(addTask).toHaveBeenCalledWith(
      expect.objectContaining({ name: "comprar pão", projectId: "p-inbox", priority: "medium", plannedDate: undefined, endDate: undefined }),
      { source: "quick_capture" }
    );
  });

  it("remover o chip de data devolve a palavra ao nome", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("abrir"));
    const input = typeText("revisar relatório de sexta");
    expect(screen.getByText("revisar relatório")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Remover: "de sexta" volta para o nome'));
    expect(screen.getByText("revisar relatório de sexta")).toBeInTheDocument();

    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(addTask).toHaveBeenCalledWith(
      expect.objectContaining({ name: "revisar relatório de sexta", plannedDate: undefined, endDate: undefined, projectId: "p-inbox" }),
      { source: "quick_capture" }
    );
  });

  it("#projeto sem casamento: avisa, mantém o texto no nome e usa a Caixa de entrada", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("abrir"));
    const input = typeText("comprar pão #Mercado amanhã");
    expect(screen.getByText(/#Mercado não encontrado/)).toBeInTheDocument();
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(addTask).toHaveBeenCalledWith(
      expect.objectContaining({ name: "comprar pão #Mercado", projectId: "p-inbox" }),
      { source: "quick_capture" }
    );
  });

  it("avisa que a hora não é salva", () => {
    renderCapture();
    fireEvent.click(screen.getByText("abrir"));
    typeText("ligar às 15h amanhã");
    expect(screen.getByText(/não é salva: as datas guardam só o dia/)).toBeInTheDocument();
  });

  it("data planejada, prazo e estimativa na mesma frase, cada um com seu chip", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("abrir"));
    const input = typeText("relatório amanhã até sexta ~1h30");
    expect(screen.getByText(/^Planejado/)).toBeInTheDocument();
    expect(screen.getByText(/^Prazo/)).toBeInTheDocument();
    expect(screen.getByText("Estimativa 1h 30m")).toBeInTheDocument();
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    const call = addTask.mock.calls[0][0];
    expect(call).toMatchObject({ name: "relatório", plannedDate: addDays(todayISO(), 1), estimateMinutes: 90 });
    expect(call.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(call.endDate).not.toBe(call.plannedDate);
  });

  it("'até sexta' sozinho vai para o prazo, sem data planejada", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("abrir"));
    const input = typeText("entregar até sexta");
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    const call = addTask.mock.calls[0][0];
    expect(call.plannedDate).toBeUndefined();
    expect(call.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("remover o chip da estimativa devolve o texto ao nome", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("abrir"));
    const input = typeText("revisar ~30m");
    fireEvent.click(screen.getByLabelText('Remover: "~30m" volta para o nome'));
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(addTask).toHaveBeenCalledWith(expect.objectContaining({ name: "revisar ~30m", estimateMinutes: undefined }), { source: "quick_capture" });
  });
});

describe("captura: aguardando (Etapa 4)", () => {
  it("'aguardando @Maria sexta': status Aguardando, cobrança na sexta, Maria não vira responsável", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("abrir"));
    const input = typeText("contrato aguardando @Maria Silva sexta");
    expect(screen.getByText(/^Aguardando Maria Silva/)).toBeInTheDocument();
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    const call = addTask.mock.calls[0][0];
    expect(call).toMatchObject({ name: "contrato", status: "waiting", waitingOnPersonId: "u-maria", waitingOnText: null });
    expect(call.plannedDate).toBeUndefined();
    expect(call.followUpDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(call.responsibleIds).toBeUndefined();
  });

  it("sem data na frase, a cobrança fica em 3 dias úteis", async () => {
    renderCapture();
    fireEvent.click(screen.getByText("abrir"));
    const input = typeText("nota aguardando fornecedor");
    expect(screen.getByText(/cobrar .* \(padrão\)/)).toBeInTheDocument();
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(addTask.mock.calls[0][0]).toMatchObject({ status: "waiting", waitingOnText: "fornecedor", followUpDate: addBusinessDaysISO(todayISO(), 3) });
  });
});

describe("atalhos globais", () => {
  const isOpen = () => screen.queryByLabelText("Texto da tarefa") !== null;

  it("Q abre fora de campos de texto", () => {
    renderCapture();
    fireEvent.keyDown(document.body, { key: "q" });
    expect(isOpen()).toBe(true);
  });

  it("Q dentro de um campo de texto não abre", () => {
    renderCapture();
    fireEvent.keyDown(screen.getByLabelText("outro campo"), { key: "q" });
    expect(isOpen()).toBe(false);
  });

  it("Q com a planilha aberta não abre", () => {
    renderCapture();
    const grid = document.createElement("div");
    grid.setAttribute("data-quick-capture-off", "");
    document.body.appendChild(grid);
    fireEvent.keyDown(document.body, { key: "q" });
    expect(isOpen()).toBe(false);
    grid.remove();
  });

  it("Ctrl+K e Cmd+K abrem", () => {
    renderCapture();
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    expect(isOpen()).toBe(true);
  });
});
