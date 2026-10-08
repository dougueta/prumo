// T008 · research R-06 — autoria pelos trailers e pelo rótulo; autor externo/fork (FR-011, FR-026).
import { describe, expect, it } from "vitest";
import {
  agentsFromTrailers,
  commitAgent,
  isExternal,
  labelAgent,
} from "../../../src/review/authorship";
import { trailers } from "./fixtures";

describe("agentsFromTrailers", () => {
  it("Claude, Gemini ou nenhum", () => {
    expect([...agentsFromTrailers(trailers.claude)]).toEqual(["claude"]);
    expect([...agentsFromTrailers(trailers.gemini)]).toEqual(["gemini"]);
    expect([...agentsFromTrailers(trailers.none)]).toEqual([]);
  });

  it("é case-insensitive e só olha linhas Co-Authored-By", () => {
    expect([...agentsFromTrailers("x\n\nco-authored-by: claude <a@b>")]).toEqual(["claude"]);
    expect([...agentsFromTrailers("feat: menciona Claude e Gemini no texto")]).toEqual([]);
  });
});

describe("commitAgent", () => {
  const c = (message: string) => ({ sha: "a".repeat(40), message });

  it("único agente nos trailers", () => {
    expect(commitAgent([c(trailers.claude), c(trailers.claude)])).toEqual({
      ok: true,
      agent: "claude",
    });
  });

  it("nenhum trailer ⇒ doug", () => {
    expect(commitAgent([c(trailers.none)])).toEqual({ ok: true, agent: "doug" });
  });

  it("commits sem trailer junto com um agente ⇒ o agente", () => {
    expect(commitAgent([c(trailers.none), c(trailers.gemini)])).toEqual({
      ok: true,
      agent: "gemini",
    });
  });

  it("dois agentes ⇒ misto", () => {
    expect(commitAgent([c(trailers.claude), c(trailers.gemini)])).toEqual({ ok: false });
  });
});

describe("labelAgent", () => {
  it("exatamente um rótulo autor:*", () => {
    expect(labelAgent(["autor:gemini", "iniciativa:2"])).toBe("gemini");
    expect(labelAgent(["autor:doug"])).toBe("doug");
  });

  it("nenhum ou mais de um ⇒ null", () => {
    expect(labelAgent(["iniciativa:0"])).toBeNull();
    expect(labelAgent(["autor:claude", "autor:gemini"])).toBeNull();
    expect(labelAgent(["autor:outro"])).toBeNull();
  });
});

describe("isExternal (FR-026)", () => {
  it("conta do Doug e branch do próprio repositório ⇒ interno", () => {
    expect(isExternal({ authorLogin: "dougueta", headRepoFullName: "dougueta/prumo" })).toBe(false);
  });

  it("autor ≠ dougueta ⇒ externo", () => {
    expect(isExternal({ authorLogin: "terceiro", headRepoFullName: "dougueta/prumo" })).toBe(true);
  });

  it("branch de fork ou fork apagado (null) ⇒ externo", () => {
    expect(isExternal({ authorLogin: "dougueta", headRepoFullName: "dougueta/prumo-fork" })).toBe(
      true,
    );
    expect(isExternal({ authorLogin: "dougueta", headRepoFullName: null })).toBe(true);
  });
});
