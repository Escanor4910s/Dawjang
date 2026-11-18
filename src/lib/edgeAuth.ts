import { supabase } from "@/integrations/supabase/client";

export async function getEdgeAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;

  const session = data.session;
  if (session.expires_at && session.expires_at <= Date.now() / 1000 + 30) {
    const refreshed = await supabase.auth.refreshSession();
    return refreshed.error ? null : refreshed.data.session?.access_token ?? null;
  }

  return session.access_token;
}
