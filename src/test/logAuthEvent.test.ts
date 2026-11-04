import { describe, expect, it, vi } from "vitest";
import {
  handleAuthEvent,
  RATE_LIMIT_GLOBAL,
  RATE_LIMIT_PER_IP,
  type AuthEventDb,
  type AuthEventLogRow,
} from "../../supabase/functions/log-auth-event/handler.ts";

// Banco falso: contadores por bucket, igual à função hit_rate_limit
function fakeDb(options: { failCounter?: boolean; failInsert?: boolean } = {}) {
  const hits = new Map<string, number>();
  const rows: AuthEventLogRow[] = [];
  const calls: string[] = [];
  const db: AuthEventDb = {
    async hitRateLimit(bucket, max) {
      calls.push(bucket);
      if (options.failCounter) throw new Error("rpc falhou");
      const n = (hits.get(bucket) ?? 0) + 1;
      hits.set(bucket, n);
      return n <= max;
    },
    async insertLog(row) {
      if (options.failInsert) throw new Error("insert falhou");
      rows.push(row);
    },
  };
  return { db, rows, calls, hits };
}

const request = (headers: Record<string, string> = {}, body: unknown = { action: "login_failed", email: "A@Teste.com" }) =>
  new Request("https://example.test/functions/v1/log-auth-event", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

// Toda resposta tem que ser idêntica ao caminho de sucesso: 204 e sem corpo
async function expectSilent204(response: Response) {
  expect(response.status).toBe(204);
  expect(await response.text()).toBe("");
}

describe("log-auth-event: resposta sempre 204 sem corpo", () => {
  it("sucesso: grava o log com o IP normalizado e responde 204", async () => {
    const { db, rows, calls } = fakeDb();
    await expectSilent204(await handleAuthEvent(request({ "cf-connecting-ip": "203.0.113.7" }), () => db));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "login_failed", user_email: "a@teste.com", ip_address: "203.0.113.7", user_id: null });
    expect(calls).toEqual(["ip4:203.0.113.7", "global"]);
  });

  it("bucket do IP estourado: 204, não grava e não consome o global", async () => {
    const { db, rows, hits } = fakeDb();
    for (let i = 0; i < RATE_LIMIT_PER_IP + 3; i++) {
      await expectSilent204(await handleAuthEvent(request({ "cf-connecting-ip": "203.0.113.7" }), () => db));
    }
    expect(rows).toHaveLength(RATE_LIMIT_PER_IP);
    expect(hits.get("global")).toBe(RATE_LIMIT_PER_IP);
  });

  it("IPv6 do mesmo /64 contam juntos no mesmo bucket", async () => {
    const { db, rows } = fakeDb();
    for (let i = 0; i < RATE_LIMIT_PER_IP; i++) {
      await handleAuthEvent(request({ "cf-connecting-ip": `2001:db8:abcd:12::${(i + 1).toString(16)}` }), () => db);
    }
    await expectSilent204(await handleAuthEvent(request({ "cf-connecting-ip": "2001:db8:abcd:12:ffff::1" }), () => db));
    expect(rows).toHaveLength(RATE_LIMIT_PER_IP);
  });

  it("global estourado: 204 e não grava", async () => {
    const { db, rows, hits } = fakeDb();
    hits.set("global", RATE_LIMIT_GLOBAL);
    await expectSilent204(await handleAuthEvent(request({ "cf-connecting-ip": "203.0.113.7" }), () => db));
    expect(rows).toHaveLength(0);
  });

  it("erro no contador: 204 e não grava (falha fechada)", async () => {
    const { db, rows } = fakeDb({ failCounter: true });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expectSilent204(await handleAuthEvent(request({ "cf-connecting-ip": "203.0.113.7" }), () => db));
    expect(rows).toHaveLength(0);
    errorSpy.mockRestore();
  });

  it("erro ao gravar: 204", async () => {
    const { db } = fakeDb({ failInsert: true });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expectSilent204(await handleAuthEvent(request({ "cf-connecting-ip": "203.0.113.7" }), () => db));
    errorSpy.mockRestore();
  });

  it("IP ausente: 204, só o limite global, grava sem IP", async () => {
    const { db, rows, calls } = fakeDb();
    await expectSilent204(await handleAuthEvent(request(), () => db));
    expect(calls).toEqual(["global"]);
    expect(rows[0].ip_address).toBeNull();
  });

  it("IP inválido: tratado como ausente", async () => {
    const { db, rows, calls } = fakeDb();
    await expectSilent204(await handleAuthEvent(request({ "cf-connecting-ip": "999.1.1.1" }), () => db));
    expect(calls).toEqual(["global"]);
    expect(rows[0].ip_address).toBeNull();
  });

  it("x-forwarded-for é ignorado", async () => {
    const { db, calls } = fakeDb();
    await handleAuthEvent(request({ "x-forwarded-for": "203.0.113.7" }), () => db);
    expect(calls).toEqual(["global"]);
  });

  it("ação não permitida, JSON inválido, payload grande e método errado: 204 sem tocar no banco", async () => {
    const { db, calls, rows } = fakeDb();
    await expectSilent204(await handleAuthEvent(request({}, { action: "login" }), () => db));
    await expectSilent204(await handleAuthEvent(request({}, "{nao é json"), () => db));
    await expectSilent204(await handleAuthEvent(request({}, { action: "signup", details: "x".repeat(3000) }), () => db));
    await expectSilent204(await handleAuthEvent(new Request("https://example.test/", { method: "GET" }), () => db));
    await expectSilent204(await handleAuthEvent(new Request("https://example.test/", { method: "OPTIONS" }), () => db));
    expect(calls).toHaveLength(0);
    expect(rows).toHaveLength(0);
  });

  it("ignora user_id enviado pelo cliente", async () => {
    const { db, rows } = fakeDb();
    await handleAuthEvent(request({}, { action: "signup", email: "x@y.com", user_id: "11111111-1111-1111-1111-111111111111" }), () => db);
    expect(rows[0].user_id).toBeNull();
  });
});
