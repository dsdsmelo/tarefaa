import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRIORITY,
  filterEntities,
  mentionAtCursor,
  parseQuickCapture,
  type ParseContext,
} from "@/lib/quickCapture/parse";
import { findDates, parseDateText } from "@/lib/quickCapture/dates";
import { fold } from "@/lib/quickCapture/text";
import { formatMinutes, parseEstimate } from "@/lib/estimate";

// Hoje fixo: quarta-feira, 04/11/2026
const TODAY = "2026-11-04";

const projects = [
  { id: "p-cliente", name: "Cliente" },
  { id: "p-cliente-x", name: "Cliente X" },
  { id: "p-reforma", name: "Reforma" },
  { id: "p-reforma-cozinha", name: "Reforma Cozinha Nova" },
  { id: "p-entrega", name: "Entrega Sexta" },
];
const people = [
  { id: "u-maria", name: "Maria Silva" },
  { id: "u-joao", name: "João Souza" },
  { id: "u-ana", name: "Ana" },
];

const ctx = (extra: Partial<ParseContext> = {}): ParseContext => ({ today: TODAY, projects, people, ...extra });
const parse = (text: string, extra: Partial<ParseContext> = {}) => parseQuickCapture(text, ctx(extra));
const dateOf = (text: string, today = TODAY) => { const r = parseQuickCapture(text, { today, projects: [], people: [] }); return (r.planned ?? r.due)?.iso ?? null; };

describe("captura rápida: exemplo completo", () => {
  it("ligar pro João amanhã p1 #Cliente X @Maria", () => {
    const r = parse("ligar pro João amanhã p1 #Cliente X @Maria");
    expect(r.name).toBe("ligar pro João");
    expect(r.planned).toMatchObject({ iso: "2026-11-05", kind: "planned", text: "amanhã" });
    expect(r.due).toBeNull();
    expect(r.priority?.value).toBe("urgent");
    expect(r.project?.id).toBe("p-cliente-x");
    expect(r.people.map(p => p.id)).toEqual(["u-maria"]);
  });

  it("sem # vai para a Caixa de entrada; sem p fica com a prioridade padrão", () => {
    const r = parse("comprar pão");
    expect(r.project).toBeNull();
    expect(r.priority).toBeNull();
    expect(DEFAULT_PRIORITY).toBe("medium");
    expect(r.name).toBe("comprar pão");
  });
});

describe("#projeto e @pessoa sem autocompletar", () => {
  it("casa com o nome existente mais longo", () => {
    expect(parse("revisar #Cliente X").project?.id).toBe("p-cliente-x");
    expect(parse("revisar #Cliente").project?.id).toBe("p-cliente");
    expect(parse("#reforma cozinha nova pintar parede").project?.id).toBe("p-reforma-cozinha");
    expect(parse("#reforma cozinha nova pintar parede").name).toBe("pintar parede");
  });

  it("depois do nome tem que vir fim de palavra", () => {
    const r = parse("ligar #cliente xavier");
    expect(r.project?.id).toBe("p-cliente");
    expect(r.name).toBe("ligar xavier");
    expect(parse("ligar #ClienteX").project).toBeNull();
  });

  it("ignora maiúsculas e acentos", () => {
    expect(parse("#CLIÊNTE x revisar").project?.id).toBe("p-cliente-x");
    expect(parse("@joão souza ligar").people[0]?.id).toBe("u-joao");
    expect(parse("@JOAO ligar").people[0]?.id).toBe("u-joao");
  });

  it("sem casamento: texto fica no nome e vai para a Caixa de entrada", () => {
    const r = parse("comprar pão #Mercado @Pedro");
    expect(r.project).toBeNull();
    expect(r.people).toEqual([]);
    expect(r.name).toBe("comprar pão #Mercado @Pedro");
    expect(r.unmatchedProjects).toEqual(["#Mercado"]);
    expect(r.unmatchedPeople).toEqual(["@Pedro"]);
  });

  it("mais de um #: vale o último e o outro fica no nome", () => {
    const r = parse("a #Cliente b #Reforma");
    expect(r.project?.id).toBe("p-reforma");
    expect(r.name).toBe("a #Cliente b");
  });

  it("pessoa pelo primeiro nome só quando ele é único", () => {
    const twoMarias = [...people, { id: "u-maria2", name: "Maria Souza" }];
    expect(parse("@Maria ligar", { people: twoMarias }).people).toEqual([]);
    expect(parse("@Maria ligar", { people: twoMarias }).unmatchedPeople).toEqual(["@Maria"]);
    expect(parse("@Maria Souza ligar", { people: twoMarias }).people[0]?.id).toBe("u-maria2");
  });

  it("várias pessoas, sem repetir", () => {
    const r = parse("reunião @Maria @Ana @maria silva");
    expect(r.people.map(p => p.id)).toEqual(["u-maria", "u-ana"]);
    expect(r.name).toBe("reunião");
  });

  it("e-mail e C# não são menções", () => {
    const r = parse("enviar para joao@empresa.com sobre C#");
    expect(r.people).toEqual([]);
    expect(r.unmatchedPeople).toEqual([]);
    expect(r.project).toBeNull();
    expect(r.name).toBe("enviar para joao@empresa.com sobre C#");
  });

  it("data dentro do nome do projeto não é data", () => {
    const r = parse("#Entrega Sexta revisar");
    expect(r.project?.id).toBe("p-entrega");
    expect(r.planned).toBeNull();
    expect(r.due).toBeNull();
  });
});

describe("prioridade", () => {
  it.each([["p1", "urgent"], ["p2", "high"], ["P3", "medium"], ["p4", "low"]])("%s", (token, value) => {
    const r = parse(`tarefa ${token}`);
    expect(r.priority?.value).toBe(value);
    expect(r.name).toBe("tarefa");
  });

  it("p5, mp3 e p10 não são prioridade", () => {
    expect(parse("tarefa p5").priority).toBeNull();
    expect(parse("baixar mp3").priority).toBeNull();
    expect(parse("tarefa p10").priority).toBeNull();
  });

  it("vale a última", () => {
    const r = parse("x p1 p3");
    expect(r.priority?.value).toBe("medium");
    expect(r.name).toBe("x p1");
  });
});

describe("datas em português (hoje = quarta 04/11/2026)", () => {
  it.each([
    ["hoje", "2026-11-04"],
    ["amanhã", "2026-11-05"],
    ["amanha", "2026-11-05"],
    ["depois de amanhã", "2026-11-06"],
    ["daqui a 3 dias", "2026-11-07"],
    ["em 2 semanas", "2026-11-18"],
    ["dentro de duas semanas", "2026-11-18"],
    ["em um mês", "2026-12-04"],
    ["em 10 dias", "2026-11-14"],
    ["semana que vem", "2026-11-09"],
    ["próxima semana", "2026-11-09"],
    ["fim do mês", "2026-11-30"],
    ["sexta", "2026-11-06"],
    ["sexta-feira", "2026-11-06"],
    ["próxima sexta", "2026-11-06"],
    ["quarta", "2026-11-11"],
    ["segunda", "2026-11-09"],
    ["seg", "2026-11-09"],
    ["terça-feira", "2026-11-10"],
    ["sábado", "2026-11-07"],
    ["domingo", "2026-11-08"],
    ["dia 10", "2026-11-10"],
    ["dia 4", "2026-11-04"],
    ["dia 3", "2026-12-03"],
    ["dia 31", "2026-12-31"],
    ["15/11", "2026-11-15"],
    ["01/03", "2027-03-01"],
    ["15/11/2027", "2027-11-15"],
    ["15/11/27", "2027-11-15"],
    ["15 de dezembro", "2026-12-15"],
    ["1º de maio", "2027-05-01"],
    ["10 de março de 2027", "2027-03-10"],
  ])("%s → %s", (text, iso) => {
    expect(dateOf(`fazer algo ${text}`)).toBe(iso);
  });

  it("em 1 mês no dia 31 vai para o último dia do mês seguinte", () => {
    expect(dateOf("x em 1 mês", "2027-01-31")).toBe("2027-02-28");
  });

  it("datas inválidas e palavras parecidas não viram data", () => {
    for (const text of ["31/02", "segundo lugar", "quando der", "sexto andar", "ter reunião", "dia 32", "13/13"]) {
      const r = parseQuickCapture(text, { today: TODAY, projects: [], people: [] });
      expect(r.planned ?? r.due, text).toBeNull();
      expect(r.name, text).toBe(text);
    }
  });

  it("marcador de prazo vai para o prazo (due); data simples é a planejada", () => {
    expect(parse("entregar até sexta")).toMatchObject({ planned: null, due: { kind: "due", iso: "2026-11-06" } });
    expect(parse("entregar prazo sexta").due?.kind).toBe("due");
    expect(parse("relatório prazo: 15/11").due).toMatchObject({ kind: "due", iso: "2026-11-15" });
    expect(parse("boleto vence dia 10").due).toMatchObject({ kind: "due", iso: "2026-11-10" });
    expect(parse("ligar na sexta")).toMatchObject({ due: null, planned: { kind: "planned", iso: "2026-11-06" } });
    expect(parse("ligar sexta").planned?.kind).toBe("planned");
    expect(parse("pagar amanhã").planned?.iso).toBe("2026-11-05");
  });

  it("marcador e preposição saem do nome junto com a data", () => {
    expect(parse("pagar conta na sexta").name).toBe("pagar conta");
    expect(parse("reunião até o dia 10").name).toBe("reunião");
    expect(parse("entregar até a sexta-feira").name).toBe("entregar");
    expect(parse("enviar no dia 15/11").name).toBe("enviar");
  });

  it("vale a última data de cada tipo; as outras ficam no nome", () => {
    const r = parse("revisar relatório de sexta amanhã");
    expect(r.planned?.iso).toBe("2026-11-05");
    expect(r.due).toBeNull();
    expect(r.name).toBe("revisar relatório de sexta");
  });

  it("hora não é salva: fica no nome e aparece como aviso", () => {
    const r = parse("ligar às 15h amanhã");
    expect(r.planned?.iso).toBe("2026-11-05");
    expect(r.times.map(t => t.text)).toEqual(["às 15h"]);
    expect(r.name).toBe("ligar às 15h");
    expect(parse("call 15:30 sexta").times.map(t => t.text)).toEqual(["15:30"]);
    expect(parse("reunião às 3 sexta").times.map(t => t.text)).toEqual(["às 3"]);
    expect(parse("comprar 15/11").times).toEqual([]);
  });
});

describe("falso positivo e chip removido na prévia", () => {
  it("'revisar relatório de sexta': o chip de data planejada aparece", () => {
    const r = parse("revisar relatório de sexta");
    expect(r.planned).toMatchObject({ iso: "2026-11-06", text: "de sexta", key: "planned:sexta" });
    expect(r.name).toBe("revisar relatório");
  });

  it("removendo o chip de data, a palavra volta para o nome", () => {
    const first = parse("revisar relatório de sexta");
    const r = parse("revisar relatório de sexta", { ignore: { dates: [first.planned!.key] } });
    expect(r.planned).toBeNull();
    expect(r.name).toBe("revisar relatório de sexta");
  });

  it("removendo a data escolhida, vale a anterior", () => {
    const r = parse("revisar relatório de sexta amanhã", { ignore: { dates: ["planned:amanha"] } });
    expect(r.planned?.iso).toBe("2026-11-06");
    expect(r.name).toBe("revisar relatório amanhã");
  });

  it("removendo prioridade, projeto e pessoa, o texto volta para o nome", () => {
    const text = "ligar p1 #Cliente X @Maria";
    expect(parse(text, { ignore: { priorities: ["p1"] } })).toMatchObject({ priority: null, name: "ligar p1" });
    const noProject = parse(text, { ignore: { projectIds: ["p-cliente-x"] } });
    expect(noProject.project).toBeNull();
    expect(noProject.unmatchedProjects).toEqual([]);
    expect(noProject.name).toBe("ligar #Cliente X");
    expect(parse(text, { ignore: { personIds: ["u-maria"] } })).toMatchObject({ people: [], name: "ligar @Maria" });
  });
});

describe("nome da tarefa", () => {
  it("só itens reconhecidos: nome vazio", () => {
    expect(parse("amanhã p1").name).toBe("");
  });

  it("arruma espaços e pontuação solta", () => {
    expect(parse("ligar pro João,   amanhã").name).toBe("ligar pro João");
    expect(parse("  p2 - revisar contrato  ").name).toBe("revisar contrato");
  });
});

describe("auxiliares", () => {
  it("parseDateText (tecla d da triagem)", () => {
    expect(parseDateText("sexta", TODAY)).toEqual({ iso: "2026-11-06", kind: "planned" });
    expect(parseDateText("até 15/11", TODAY)).toEqual({ iso: "2026-11-15", kind: "due" });
    expect(parseDateText("", TODAY)).toBeNull();
    expect(parseDateText("qualquer coisa", TODAY)).toBeNull();
  });

  it("mentionAtCursor", () => {
    expect(mentionAtCursor("ligar #Cli", 10)).toEqual({ marker: "#", start: 6, query: "Cli" });
    expect(mentionAtCursor("ligar @Maria S", 14)).toEqual({ marker: "@", start: 6, query: "Maria S" });
    expect(mentionAtCursor("email a@b", 9)).toBeNull();
    expect(mentionAtCursor("sem marcador", 12)).toBeNull();
  });

  it("filterEntities ignora acentos e põe prefixo primeiro", () => {
    expect(filterEntities(projects, "cli").map(p => p.id)).toEqual(["p-cliente", "p-cliente-x"]);
    expect(filterEntities(projects, "COZINHA").map(p => p.id)).toEqual(["p-reforma-cozinha"]);
    expect(filterEntities(people, "joao").map(p => p.id)).toEqual(["u-joao"]);
  });

  it("fold mantém o comprimento", () => {
    const text = "Ação até é ÇÃO º 😀";
    expect(fold(text)).toHaveLength(text.length);
    expect(fold("Terça-Feira")).toBe("terca-feira");
  });

  it("findDates não sobrepõe expressões", () => {
    expect(findDates("depois de amanhã", TODAY).map(d => d.iso)).toEqual(["2026-11-06"]);
  });
});

describe("Etapa 3: data planejada e prazo na mesma frase", () => {
  it("'relatório amanhã até sexta': planejado amanhã, prazo sexta", () => {
    const r = parse("relatório amanhã até sexta");
    expect(r.planned).toMatchObject({ iso: "2026-11-05", text: "amanhã", key: "planned:amanha" });
    expect(r.due).toMatchObject({ iso: "2026-11-06", text: "até sexta", key: "due:sexta" });
    expect(r.name).toBe("relatório");
  });

  it("ordem invertida: prazo primeiro, planejada depois", () => {
    const r = parse("boleto vence dia 10 pagar segunda");
    expect(r.due?.iso).toBe("2026-11-10");
    expect(r.planned?.iso).toBe("2026-11-09");
    expect(r.name).toBe("boleto pagar");
  });

  it("vale o último prazo e a última planejada, cada um no seu tipo", () => {
    const r = parse("x até sexta amanhã prazo 15/11 hoje");
    expect(r.planned?.iso).toBe("2026-11-04");
    expect(r.due?.iso).toBe("2026-11-15");
    expect(r.name).toBe("x até sexta amanhã");
  });

  it("removendo o chip do prazo, a planejada continua", () => {
    const r = parse("relatório amanhã até sexta", { ignore: { dates: ["due:sexta"] } });
    expect(r.planned?.iso).toBe("2026-11-05");
    expect(r.due).toBeNull();
    expect(r.name).toBe("relatório até sexta");
  });

  it("remover a planejada 'sexta' não remove o prazo 'até sexta'", () => {
    const r = parse("ligar sexta até sexta", { ignore: { dates: ["planned:sexta"] } });
    expect(r.planned).toBeNull();
    expect(r.due?.iso).toBe("2026-11-06");
  });
});

describe("Etapa 3: estimativa", () => {
  it.each([
    ["~30m", 30], ["~2h", 120], ["~1h30", 90], ["~1h30m", 90], ["~90min", 90], ["~45", 45], ["~1,5h", 90], ["~24h", 1440],
  ])("%s = %i minutos", (token, minutes) => {
    const r = parse(`revisar contrato ${token}`);
    expect(r.estimate).toMatchObject({ minutes, text: token });
    expect(r.name).toBe("revisar contrato");
  });

  it("fora da faixa ou sem ~ fica no nome", () => {
    for (const text of ["x ~0m", "x ~25h", "x ~1h75", "x 30m", "x ~abc", "x~30m"]) {
      const r = parse(text);
      expect(r.estimate, text).toBeNull();
      expect(r.name, text).toBe(text);
    }
  });

  it("'~2h' não vira hora; pontuação depois é aceita", () => {
    const r = parse("call ~2h, amanhã");
    expect(r.estimate?.minutes).toBe(120);
    expect(r.times).toEqual([]);
    expect(r.name).toBe("call");
  });

  it("vale a última estimativa; a anterior fica no nome", () => {
    const r = parse("x ~30m ~1h");
    expect(r.estimate?.minutes).toBe(60);
    expect(r.name).toBe("x ~30m");
  });

  it("removendo o chip, a estimativa volta para o nome", () => {
    const r = parse("revisar ~30m", { ignore: { estimates: ["30m"] } });
    expect(r.estimate).toBeNull();
    expect(r.name).toBe("revisar ~30m");
  });

  it("combinação completa: projeto, pessoa, prioridade, estimativa, planejada e prazo", () => {
    const r = parse("preparar proposta #Cliente X @Maria p2 ~1h30 amanhã prazo sexta");
    expect(r).toMatchObject({
      name: "preparar proposta",
      project: { id: "p-cliente-x" },
      priority: { value: "high" },
      estimate: { minutes: 90 },
      planned: { iso: "2026-11-05" },
      due: { iso: "2026-11-06" },
    });
    expect(r.people.map(p => p.id)).toEqual(["u-maria"]);
  });
});

describe("Etapa 3: parseEstimate e formatMinutes", () => {
  it("parseEstimate aceita os formatos do formulário", () => {
    expect(parseEstimate("30")).toBe(30);
    expect(parseEstimate("30 min")).toBe(30);
    expect(parseEstimate("1h 30m")).toBe(90);
    expect(parseEstimate("1:30")).toBe(90);
    expect(parseEstimate("2H")).toBe(120);
    expect(parseEstimate("0")).toBeNull();
    expect(parseEstimate("1441")).toBeNull();
    expect(parseEstimate("1:75")).toBeNull();
    expect(parseEstimate("")).toBeNull();
    expect(parseEstimate("muito")).toBeNull();
  });

  it("formatMinutes", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(0)).toBe("0h");
  });
});
