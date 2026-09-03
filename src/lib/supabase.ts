"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const configured = Boolean(url && anon);

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!configured) throw new Error("Supabase env vars are not set");
  if (!_client)
    _client = createClient(url!, anon!, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  return _client;
}
