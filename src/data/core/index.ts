/**
 * Superfície pública do modelo de dados core (feature 004). Outras features importam SOMENTE
 * daqui — importar `./supabase/*` ou `./memory/*` é proibido por regra de lint (Constitution VII).
 */
export type { CoreStore } from "./ports";
export type * from "@/domain/core/types";
export { CoreError } from "@/domain/core/errors";
export type { CoreErrorCode, ForbiddenReason } from "@/domain/core/errors";
export {
  createCoreStore,
  getCoreStore,
  registerOwnerContextProvider,
  DEMO_OWNER_ID,
  DEMO_SESSION_COOKIE,
} from "./context";
export type { OwnerContext, OwnerContextProvider } from "./context";
