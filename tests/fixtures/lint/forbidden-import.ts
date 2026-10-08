// Fixture de lint (004 · T065): importar a implementação Supabase fora de src/data/core é proibido.
import { SupabaseCoreStore } from "@/data/core/supabase/supabase-store";

export const leaked = SupabaseCoreStore;
