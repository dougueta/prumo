import type { OwnerId } from "@/domain/core/types";

/** Único dono do modo demonstração (contracts/owner-context.md). A 006 importa daqui. */
export const DEMO_OWNER_ID = "00000000-0000-4000-8000-00000000d3e0" as OwnerId;

/** Cookie da sessão de demonstração (só em APP_ENV=preview). */
export const DEMO_SESSION_COOKIE = "prumo_demo_sid";
