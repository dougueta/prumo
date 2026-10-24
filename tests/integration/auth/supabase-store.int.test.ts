import { SupabaseAuthStore } from "@/lib/auth/supabase-store";
import { defineAuthStoreSuite } from "../../shared/auth-store-suite";
import { createTestOwner, serviceClient } from "../../helpers/supabase-test";

// 006 — contrato da AuthStore contra o Supabase local/CI (migração da T014, cliente de serviço).
defineAuthStoreSuite("Supabase", {
  store: () => new SupabaseAuthStore(serviceClient()),
  newOwner: async () => (await createTestOwner()).id,
});
