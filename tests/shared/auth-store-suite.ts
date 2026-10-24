import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { AuthStore, EventRow } from "@/lib/auth/store";

/**
 * Contrato único da AuthStore (006): roda contra a MemoryAuthStore (unit) e a SupabaseAuthStore
 * (integração, banco real). Mesmo comportamento nos dois — inclusive as janelas do rate limit,
 * que precisam bater com `countRateLimit` (rate-limit.ts).
 */
export type StoreHarness = {
  store: () => AuthStore;
  /** Um dono novo (no Supabase: usuário real em auth.users, por causa das FKs). */
  newOwner: () => Promise<string>;
};

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const hex = () => randomUUID().replaceAll("-", "").padEnd(64, "0");

function event(overrides: Partial<EventRow>): EventRow {
  return {
    type: "logout",
    reason: null,
    method: "none",
    owner_id: null,
    session_id: null,
    email_hash: null,
    email_masked: null,
    ip_hash: null,
    device_label: "iPhone · Safari",
    geo: null,
    ...overrides,
  };
}

export function defineAuthStoreSuite(name: string, harness: StoreHarness) {
  describe(`AuthStore — ${name}`, () => {
    let store: AuthStore;
    beforeAll(() => {
      store = harness.store();
    });

    describe("eventos", () => {
      it("listEvents: do dono e anônimos, 90 dias, mais recentes primeiro", async () => {
        const owner = await harness.newOwner();
        const other = await harness.newOwner();
        const now = new Date();
        const at = (ms: number) => new Date(now.getTime() - ms);
        const marker = hex();
        await store.insertEvent(
          event({ type: "logout", owner_id: owner, occurred_at: at(2 * MIN) }),
        );
        await store.insertEvent(
          event({
            type: "login_succeeded",
            method: "email_otp",
            owner_id: owner,
            email_hash: marker,
            occurred_at: at(MIN),
          }),
        );
        await store.insertEvent(
          event({
            type: "email_refused",
            email_hash: hex(),
            email_masked: "es***@e***.com",
            occurred_at: at(30 * 1000),
          }),
        );
        await store.insertEvent(
          event({ type: "logout", owner_id: owner, occurred_at: at(91 * DAY) }),
        );
        await store.insertEvent(
          event({ type: "logout_all", owner_id: other, occurred_at: at(10 * 1000) }),
        );

        const events = await store.listEvents({ ownerId: owner, now });
        const mine = events.filter((e) => e.owner_id === owner);
        expect(mine.map((e) => e.type)).toEqual(["login_succeeded", "logout"]);
        expect(events.some((e) => e.type === "email_refused" && e.owner_id === null)).toBe(true);
        expect(events.some((e) => e.owner_id === other)).toBe(false);
        expect(events.every((e) => now.getTime() - e.occurredAt.getTime() <= 90 * DAY)).toBe(true);
        for (let i = 1; i < events.length; i++) {
          expect(events[i - 1].occurredAt.getTime()).toBeGreaterThanOrEqual(
            events[i].occurredAt.getTime(),
          );
        }
      });

      it("rateLimitCounts: só otp_failed conta como falha; janelas de 15 min, 60 s e 1 h", async () => {
        const now = new Date();
        const at = (ms: number) => new Date(now.getTime() - ms);
        const email = hex();
        const ip = hex();
        const rows: EventRow[] = [
          event({
            type: "otp_failed",
            reason: "wrong_code",
            email_hash: email,
            ip_hash: ip,
            occurred_at: at(MIN),
          }),
          event({
            type: "otp_failed",
            reason: "wrong_code",
            email_hash: email,
            ip_hash: hex(),
            occurred_at: at(14 * MIN),
          }),
          event({
            type: "otp_failed",
            reason: "wrong_code",
            email_hash: hex(),
            ip_hash: ip,
            occurred_at: at(2 * MIN),
          }),
          event({
            type: "otp_failed",
            reason: "wrong_code",
            email_hash: email,
            ip_hash: ip,
            occurred_at: at(16 * MIN),
          }),
          event({ type: "email_refused", email_hash: email, ip_hash: ip, occurred_at: at(MIN) }),
          event({
            type: "login_blocked",
            reason: "rate_ip",
            email_hash: email,
            ip_hash: ip,
            occurred_at: at(MIN),
          }),
          event({
            type: "otp_requested",
            email_hash: email,
            ip_hash: ip,
            occurred_at: at(30 * 1000),
          }),
          event({
            type: "otp_requested",
            email_hash: email,
            ip_hash: ip,
            occurred_at: at(30 * MIN),
          }),
          event({
            type: "otp_requested",
            email_hash: email,
            ip_hash: ip,
            occurred_at: at(61 * MIN),
          }),
        ];
        for (const row of rows) expect(await store.insertEvent(row)).toBe(true);
        expect(await store.rateLimitCounts({ emailHash: email, ipHash: ip, now })).toEqual({
          failedByEmail: 2,
          failedByIp: 2,
          requestsLastMinute: 1,
          requestsLastHour: 2,
        });
      });

      it("otpHistory: pedidos e logins do e-mail", async () => {
        const email = hex();
        const now = new Date();
        await store.insertEvent(
          event({
            type: "otp_requested",
            email_hash: email,
            occurred_at: new Date(now.getTime() - 2 * MIN),
          }),
        );
        await store.insertEvent(
          event({
            type: "login_succeeded",
            method: "email_otp",
            email_hash: email,
            occurred_at: new Date(now.getTime() - MIN),
          }),
        );
        await store.insertEvent(
          event({ type: "otp_failed", reason: "wrong_code", email_hash: email }),
        );
        const history = await store.otpHistory(email);
        expect(history.map((e) => [e.type, e.method]).sort()).toEqual([
          ["login_succeeded", "email_otp"],
          ["otp_requested", "none"],
        ]);
      });
    });

    describe("sessões", () => {
      it("insertSession é idempotente e grava a validade absoluta de 90 dias", async () => {
        const owner = await harness.newOwner();
        const id = randomUUID();
        const now = new Date();
        const input = {
          id,
          ownerId: owner,
          deviceId: randomUUID(),
          method: "email_otp" as const,
          deviceLabel: "iPhone · Safari",
          now,
        };
        await store.insertSession(input);
        await store.insertSession({ ...input, deviceLabel: "outro" });
        const found = await store.getSession(id);
        expect(found).not.toBeNull();
        expect(found!.session).toMatchObject({
          id,
          ownerId: owner,
          method: "email_otp",
          deviceLabel: "iPhone · Safari",
          endedAt: null,
          unlockFailures: 0,
        });
        expect(
          found!.session.absoluteExpiresAt.getTime() - found!.session.createdAt.getTime(),
        ).toBe(90 * DAY);
        expect(found!.hasDeviceCredential).toBe(false);
      });

      it("getSession de id desconhecido ⇒ null", async () => {
        expect(await store.getSession(randomUUID())).toBeNull();
      });

      it("touchSession atualiza o último uso; endSession encerra uma vez só", async () => {
        const owner = await harness.newOwner();
        const id = randomUUID();
        const created = new Date(Date.now() - 20 * MIN);
        await store.insertSession({
          id,
          ownerId: owner,
          deviceId: randomUUID(),
          method: "google",
          deviceLabel: "x",
          now: created,
        });
        const later = new Date();
        await store.touchSession(id, later);
        expect((await store.getSession(id))!.session.lastActiveAt.getTime()).toBe(later.getTime());
        expect(await store.endSession(id, "logout", later)).toBe(true);
        expect(await store.endSession(id, "idle_30d", later)).toBe(false);
        expect((await store.getSession(id))!.session).toMatchObject({ endReason: "logout" });
        const touchedAfterEnd = new Date(later.getTime() + MIN);
        await store.touchSession(id, touchedAfterEnd);
        expect((await store.getSession(id))!.session.lastActiveAt.getTime()).toBe(later.getTime());
      });

      it("endAllSessions encerra só as abertas do dono; listSessions só abertas, recentes primeiro", async () => {
        const owner = await harness.newOwner();
        const other = await harness.newOwner();
        const now = Date.now();
        const make = async (ownerId: string, ageMs: number) => {
          const id = randomUUID();
          await store.insertSession({
            id,
            ownerId,
            deviceId: randomUUID(),
            method: "email_otp",
            deviceLabel: "x",
            now: new Date(now - ageMs),
          });
          return id;
        };
        const old = await make(owner, 3 * MIN);
        const recent = await make(owner, MIN);
        const ended = await make(owner, 2 * MIN);
        await store.endSession(ended, "logout", new Date());
        const foreign = await make(other, MIN);

        expect((await store.listSessions(owner)).map((s) => s.id)).toEqual([recent, old]);
        expect((await store.endAllSessions(owner, "logout_all", new Date())).sort()).toEqual(
          [old, recent].sort(),
        );
        expect(await store.listSessions(owner)).toEqual([]);
        expect((await store.getSession(ended))!.session.endReason).toBe("logout");
        expect((await store.getSession(foreign))!.session.endedAt).toBeNull();
      });
    });
  });
}
