import { describe, expect, it } from "vitest";
import { normalizeIp, resolveClientIp } from "../../supabase/functions/_shared/clientIp.ts";

const headers = (values: Record<string, string>) => new Headers(values);

describe("normalizeIp: IPv4", () => {
  it("usa o endereço exato como bucket", () => {
    expect(normalizeIp("203.0.113.7")).toEqual({ ip: "203.0.113.7", bucket: "ip4:203.0.113.7" });
    expect(normalizeIp("  198.51.100.1  ")?.bucket).toBe("ip4:198.51.100.1");
    expect(normalizeIp("0.0.0.0")?.bucket).toBe("ip4:0.0.0.0");
  });

  it.each(["256.1.1.1", "1.2.3", "1.2.3.4.5", "01.2.3.4", "1.2.3.-4", "a.b.c.d", "1.2.3.4/24", ""])(
    "trata %j como inválido",
    (value) => expect(normalizeIp(value)).toBeNull(),
  );
});

describe("normalizeIp: IPv6", () => {
  it("agrupa pelo prefixo /64", () => {
    expect(normalizeIp("2001:db8:0:1::5")).toEqual({ ip: "2001:db8:0:1::5", bucket: "ip6:2001:db8:0:1/64" });
  });

  it("dois endereços do mesmo /64 caem no mesmo bucket", () => {
    const a = normalizeIp("2001:db8:abcd:12::1");
    const b = normalizeIp("2001:0DB8:ABCD:0012:ffff:eeee:dddd:cccc");
    expect(a?.bucket).toBe("ip6:2001:db8:abcd:12/64");
    expect(b?.bucket).toBe(a?.bucket);
    expect(b?.ip).not.toBe(a?.ip);
  });

  it("endereços de /64 diferentes caem em buckets diferentes", () => {
    expect(normalizeIp("2001:db8:abcd:12::1")?.bucket).not.toBe(normalizeIp("2001:db8:abcd:13::1")?.bucket);
  });

  it("forma completa e comprimida do mesmo endereço são iguais", () => {
    expect(normalizeIp("2001:0db8:0000:0000:0000:0000:0000:0001")).toEqual(normalizeIp("2001:db8::1"));
    expect(normalizeIp("::1")).toEqual({ ip: "::1", bucket: "ip6:0:0:0:0/64" });
  });

  it("IPv4 representado em IPv6 usa o bucket do IPv4", () => {
    expect(normalizeIp("::ffff:203.0.113.7")).toEqual({ ip: "203.0.113.7", bucket: "ip4:203.0.113.7" });
    expect(normalizeIp("::ffff:cb00:7107")).toEqual({ ip: "203.0.113.7", bucket: "ip4:203.0.113.7" });
  });

  it.each([
    "2001:db8::1::2",
    "1:2:3:4:5:6:7:8:9",
    "1:2:3:4:5:6:7",
    "2001:db8:12345::1",
    "fe80::1%eth0",
    "[::1]:443",
    "[2001:db8::1]",
    ":::",
    "1:::2",
    "2001:db8::g1",
    "::ffff:256.0.0.1",
    "a".repeat(46),
  ])("trata %j como inválido", (value) => expect(normalizeIp(value)).toBeNull());
});

describe("resolveClientIp", () => {
  it("usa cf-connecting-ip primeiro", () => {
    const h = headers({ "cf-connecting-ip": "203.0.113.7", "sb-forwarded-for": "198.51.100.9" });
    expect(resolveClientIp(h)?.ip).toBe("203.0.113.7");
  });

  it("sem cf-connecting-ip, usa sb-forwarded-for", () => {
    expect(resolveClientIp(headers({ "sb-forwarded-for": "198.51.100.9" }))?.ip).toBe("198.51.100.9");
  });

  it("cf-connecting-ip inválido conta como ausente e cai no sb-forwarded-for", () => {
    const h = headers({ "cf-connecting-ip": "not-an-ip", "sb-forwarded-for": "198.51.100.9" });
    expect(resolveClientIp(h)?.ip).toBe("198.51.100.9");
  });

  it("sb-forwarded-for com lista de valores é inválido", () => {
    expect(resolveClientIp(headers({ "sb-forwarded-for": "198.51.100.9, 10.0.0.1" }))).toBeNull();
  });

  it("sem nenhum header confiável, devolve null (só limite global)", () => {
    expect(resolveClientIp(headers({}))).toBeNull();
  });

  it("nunca usa x-forwarded-for nem x-real-ip", () => {
    const h = headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "x-real-ip": "203.0.113.8" });
    expect(resolveClientIp(h)).toBeNull();
  });
});
