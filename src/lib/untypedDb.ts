import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Client Supabase non typé : à utiliser uniquement pour les tables absentes du schéma
 * généré (types.ts) ou résolues dynamiquement par nom. Centralise l'unique conversion
 * de type au lieu de la disperser dans le code applicatif.
 */
const untypedClient = supabase as unknown as SupabaseClient;

export function untypedTable(name: string) {
  return untypedClient.from(name);
}
