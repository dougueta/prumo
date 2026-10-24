import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { applyDemoSessionCookie } from "@/lib/demo-session-cookie";

// 004 · T053 — cookie prumo_demo_sid emitido pelo proxy só em preview (contracts/owner-context.md).
const request = (url: string, cookie?: string) =>
  new NextRequest(url, cookie ? { headers: { cookie } } : undefined);

describe("applyDemoSessionCookie", () => {
  it("em preview sem cookie emite prumo_demo_sid (UUID v4, HttpOnly, Lax, Path=/, 2 h, Secure)", () => {
    const response = applyDemoSessionCookie(
      request("https://prumo-preview.vercel.app/"),
      NextResponse.next(),
      "preview",
    );
    const header = response.headers.get("set-cookie") ?? "";
    expect(header).toMatch(
      /^prumo_demo_sid=[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12};/,
    );
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=lax/i);
    expect(header).toMatch(/Path=\//);
    expect(header).toMatch(/Max-Age=7200/);
    expect(header).toMatch(/Secure/i);
  });

  it("em localhost não marca Secure", () => {
    const response = applyDemoSessionCookie(
      request("http://localhost:3000/"),
      NextResponse.next(),
      "preview",
    );
    expect(response.headers.get("set-cookie")).not.toMatch(/Secure/i);
  });

  it("com cookie existente não reemite", () => {
    const response = applyDemoSessionCookie(
      request("https://x.vercel.app/", "prumo_demo_sid=abc"),
      NextResponse.next(),
      "preview",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each(["local", "production"] as const)("fora de preview (%s) nunca emite", (env) => {
    const response = applyDemoSessionCookie(request("https://x/"), NextResponse.next(), env);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
