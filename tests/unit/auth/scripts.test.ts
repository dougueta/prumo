import { describe, expect, it, vi } from "vitest";
import {
  agePatch,
  assertLocal,
  parseAgeArgs,
  provision,
  type AdminApi,
} from "../../../scripts/auth-tools";

/** 006 · T066 (FR-001) — provisionamento da allowlist e envelhecimento de sessão (só local). */

function fakeAdmin(existing: string[]) {
  const users = existing.map((email, i) => ({ id: `u${i}`, email }));
  const createUser = vi.fn(async ({ email }: { email: string; email_confirm: boolean }) => {
    users.push({ id: `u${users.length}`, email });
    return { error: null };
  });
  const admin: AdminApi = {
    listUsers: vi.fn(async ({ page, perPage }: { page: number; perPage: number }) => ({
      data: { users: users.slice((page - 1) * perPage, page * perPage) },
      error: null,
    })),
    createUser,
  };
  return { admin, createUser, users };
}

describe("provision", () => {
  it("cria só quem falta, com e-mail já confirmado", async () => {
    const f = fakeAdmin(["doug@example.test"]);
    const lines: string[] = [];
    await provision(["doug@example.test", "segundo@example.test"], f.admin, (l) => lines.push(l));
    expect(f.createUser).toHaveBeenCalledTimes(1);
    expect(f.createUser).toHaveBeenCalledWith({
      email: "segundo@example.test",
      email_confirm: true,
    });
  });

  it("é idempotente: rodar duas vezes não duplica", async () => {
    const f = fakeAdmin([]);
    await provision(["doug@example.test"], f.admin, () => {});
    await provision(["doug@example.test"], f.admin, () => {});
    expect(f.createUser).toHaveBeenCalledTimes(1);
    expect(f.users.filter((u) => u.email === "doug@example.test")).toHaveLength(1);
  });

  it("compara sem diferenciar maiúsculas e percorre todas as páginas da Admin API", async () => {
    const many = Array.from({ length: 250 }, (_, i) => `u${i}@example.test`);
    const f = fakeAdmin([...many, "Doug@Example.test"]);
    await provision(["doug@example.test"], f.admin, () => {});
    expect(f.createUser).not.toHaveBeenCalled();
  });

  it("a saída só mostra e-mails mascarados", async () => {
    const f = fakeAdmin(["doug@example.test"]);
    const lines: string[] = [];
    await provision(["doug@example.test", "pessoal.real@gmail.com"], f.admin, (l) => lines.push(l));
    const out = lines.join("\n");
    expect(out).not.toContain("doug@example.test");
    expect(out).not.toContain("pessoal.real");
    expect(out).toContain("do***@e***.test");
    expect(out).toContain("pe***@g***.com");
  });

  it("falha se a Admin API falhar (sem repetir o e-mail na mensagem)", async () => {
    const admin: AdminApi = {
      listUsers: async () => ({ data: { users: [] }, error: { message: "boom" } }),
      createUser: async () => ({ error: null }),
    };
    await expect(provision(["doug@example.test"], admin, () => {})).rejects.toThrow(/Admin API/);
  });
});

describe("auth:age-session", () => {
  it("recusa qualquer ambiente que não seja local", () => {
    expect(() => assertLocal("production")).toThrow(/local/);
    expect(() => assertLocal("preview")).toThrow(/local/);
    expect(() => assertLocal(undefined)).toThrow(/local/);
    expect(() => assertLocal("local")).not.toThrow();
  });

  it("lê --minutes N ou --days N (um e só um, inteiro positivo)", () => {
    expect(parseAgeArgs(["--minutes", "16"])).toEqual({ minutes: 16 });
    expect(parseAgeArgs(["--days", "31"])).toEqual({ days: 31 });
    for (const bad of [
      [],
      ["--minutes"],
      ["--minutes", "-1"],
      ["--days", "x"],
      ["--minutes", "1", "--days", "1"],
    ]) {
      expect(() => parseAgeArgs(bad), bad.join(" ")).toThrow();
    }
  });

  const row = {
    id: "s1",
    created_at: "2026-10-01T12:00:00.000Z",
    absolute_expires_at: "2026-12-30T12:00:00.000Z",
    last_active_at: "2026-10-10T12:00:00.000Z",
  };

  it("--minutes recua só o último uso (bloqueio por inatividade)", () => {
    expect(agePatch(row, { minutes: 16 })).toEqual({ last_active_at: "2026-10-10T11:44:00.000Z" });
  });

  it("--days recua tudo junto (mantém a regra created_at + 90 d e simula idle/absoluta)", () => {
    expect(agePatch(row, { days: 91 })).toEqual({
      created_at: "2026-07-02T12:00:00.000Z",
      absolute_expires_at: "2026-09-30T12:00:00.000Z",
      last_active_at: "2026-07-11T12:00:00.000Z",
    });
  });
});
