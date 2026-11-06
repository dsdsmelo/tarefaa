import { describe, expect, it } from "vitest";
import {
  buildDigests,
  daysBetween,
  emailSubject,
  followUpLine,
  renderEmailHtml,
  renderEmailText,
  type PersonRow,
  type TaskRow,
} from "../../supabase/functions/send-task-reminders/digest.ts";

const TODAY = "2026-11-06";
const TOMORROW = "2026-11-07";
const people: PersonRow[] = [
  { id: "resp", name: "Ana Responsável", email: "ana@x.com", active: true },
  { id: "semEmail", name: "Sem Email", email: null, active: true },
  { id: "inativa", name: "Inativa", email: "i@x.com", active: false },
  { id: "esperado", name: "Bruno Fornecedor", email: "bruno@x.com", active: true },
];
const t = (id: string, extra: Partial<TaskRow>): TaskRow => ({
  id, name: `tarefa ${id}`, priority: "medium", status: "pending", end_date: null, responsible_ids: ["resp"],
  project_id: "p1", projects: { name: "Projeto", status: "active" }, ...extra,
});

describe("send-task-reminders: agrupamento (D1 a D3)", () => {
  it("prazos de hoje/amanhã e cobranças vão para o responsável", () => {
    const [d, ...rest] = buildDigests({
      dueTasks: [t("hoje", { end_date: TODAY }), t("amanha", { end_date: TOMORROW })],
      followUpTasks: [t("cob", { status: "waiting", follow_up_date: TODAY, waiting_on_person_id: "esperado" })],
      people, today: TODAY,
    });
    expect(rest).toEqual([]);
    expect(d.person.id).toBe("resp");
    expect(d.today.map(x => x.id)).toEqual(["hoje"]);
    expect(d.tomorrow.map(x => x.id)).toEqual(["amanha"]);
    expect(d.followUps.map(x => x.id)).toEqual(["cob"]);
  });

  it("a pessoa de quem se espera nunca recebe (só se também for responsável)", () => {
    const digests = buildDigests({
      dueTasks: [],
      followUpTasks: [t("cob", { status: "waiting", follow_up_date: TODAY, waiting_on_person_id: "esperado" })],
      people, today: TODAY,
    });
    expect(digests.map(d => d.person.id)).toEqual(["resp"]);
  });

  it("sem e-mail, inativa ou sem responsável: ninguém recebe", () => {
    expect(buildDigests({ dueTasks: [t("a", { end_date: TODAY, responsible_ids: ["semEmail", "inativa"] }), t("b", { end_date: TODAY, responsible_ids: null })], followUpTasks: [], people, today: TODAY })).toEqual([]);
  });

  it("Aguardando sai de 'vencem hoje'; cobranças atrasadas entram, futuras não", () => {
    const [d] = buildDigests({
      dueTasks: [t("aguardando-vence-hoje", { status: "waiting", end_date: TODAY })],
      followUpTasks: [
        t("atrasada", { status: "waiting", follow_up_date: "2026-11-03" }),
        t("futura", { status: "waiting", follow_up_date: "2026-11-09" }),
        t("voltou", { status: "pending", follow_up_date: TODAY }),
      ],
      people, today: TODAY,
    });
    expect(d.today).toEqual([]);
    expect(d.followUps.map(x => x.id)).toEqual(["atrasada"]);
  });

  it("projetos em Ideia ficam fora", () => {
    const idea = { name: "Geladeira", status: "idea" };
    expect(buildDigests({
      dueTasks: [t("a", { end_date: TODAY, projects: idea })],
      followUpTasks: [t("b", { status: "waiting", follow_up_date: TODAY, projects: idea })],
      people, today: TODAY,
    })).toEqual([]);
  });

  it("linha da cobrança, assunto e conteúdo", () => {
    const names = new Map([["esperado", "Bruno Fornecedor"]]);
    const late = t("x", { status: "waiting", follow_up_date: "2026-11-04", waiting_on_person_id: "esperado", end_date: "2026-11-10" });
    expect(followUpLine(late, TODAY, names)).toBe("Aguardando Bruno Fornecedor · atrasada há 2 dias · prazo 10/11");
    expect(followUpLine(t("y", { status: "waiting", follow_up_date: TODAY, waiting_on_text: "cliente" }), TODAY, names)).toBe("Aguardando cliente · cobrar hoje");
    const [d] = buildDigests({ dueTasks: [t("h", { end_date: TODAY })], followUpTasks: [late], people, today: TODAY });
    expect(emailSubject(d)).toBe("⚠️ 1 tarefa vence hoje · 📌 1 cobrança hoje");
    const html = renderEmailHtml(d, TODAY, names, "https://app.tarefaa.com.br");
    expect(html).toContain("Cobranças de hoje (1)");
    expect(html).toContain("atrasada há 2 dias");
    expect(renderEmailText(d, TODAY, names, "https://app.tarefaa.com.br")).toContain("COBRANÇAS DE HOJE (1):");
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
  });

  it("escapa HTML do nome da tarefa e de quem se espera", () => {
    const [d] = buildDigests({ dueTasks: [], followUpTasks: [t("z", { name: "<b>x</b>", status: "waiting", follow_up_date: TODAY, waiting_on_text: "<i>y</i>" })], people, today: TODAY });
    const html = renderEmailHtml(d, TODAY, new Map(), "https://a");
    expect(html).not.toContain("<b>x</b>");
    expect(html).not.toContain("<i>y</i>");
  });
});
