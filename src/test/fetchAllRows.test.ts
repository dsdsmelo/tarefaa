import { describe, expect, it } from "vitest";
import { fetchAllRows, fetchAllRowsByIds } from "@/lib/fetchAllRows";

// Simula a API do Supabase: devolve no máximo `serverCap` linhas por requisição
const fakeTable = (total: number, serverCap = 1000, withCount = true) => {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  let calls = 0;
  const query = () => ({
    range: async (from: number, to: number) => {
      calls++;
      const end = Math.min(to + 1, from + serverCap);
      return { data: rows.slice(from, end), error: null, count: withCount ? total : null };
    },
  });
  return { query, calls: () => calls };
};

describe("fetchAllRows", () => {
  it("busca mais de 1000 linhas sem perder nenhuma", async () => {
    const table = fakeTable(2345);
    const rows = await fetchAllRows<{ id: number }>(table.query);
    expect(rows).toHaveLength(2345);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2345);
    expect(table.calls()).toBe(3);
  });

  it("faz uma única requisição para tabelas pequenas", async () => {
    const table = fakeTable(42);
    expect(await fetchAllRows(table.query)).toHaveLength(42);
    expect(table.calls()).toBe(1);
  });

  it("não depende do limite do servidor quando há count", async () => {
    // servidor configurado com limite menor (500) que a página pedida (1000)
    const table = fakeTable(1700, 500);
    expect(await fetchAllRows(table.query)).toHaveLength(1700);
  });

  it("lida com tabela vazia e com total múltiplo exato da página", async () => {
    expect(await fetchAllRows(fakeTable(0).query)).toHaveLength(0);
    expect(await fetchAllRows(fakeTable(2000).query)).toHaveLength(2000);
  });

  it("lança erro em vez de devolver dados parciais", async () => {
    let calls = 0;
    const query = () => ({
      range: async () => {
        calls++;
        if (calls === 2) return { data: null, error: { message: "falhou", details: "", hint: "", code: "500" }, count: 3000 };
        return { data: Array.from({ length: 1000 }, (_, i) => ({ id: i })), error: null, count: 3000 };
      },
    });
    await expect(fetchAllRows(query)).rejects.toMatchObject({ message: "falhou" });
  });

  it("divide listas grandes de ids em lotes e pagina cada lote", async () => {
    const ids = Array.from({ length: 400 }, (_, i) => `id-${i}`);
    const chunks: number[] = [];
    const rows = await fetchAllRowsByIds<{ id: string }>(ids, (chunk) => {
      chunks.push(chunk.length);
      return { range: async () => ({ data: chunk.map((id) => ({ id })), error: null, count: chunk.length }) };
    });
    expect(rows).toHaveLength(400);
    expect(chunks).toEqual([150, 150, 100]);
  });
});
