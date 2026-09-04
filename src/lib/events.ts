"use client";
import { supabase } from "./supabase";

/**
 * Fire-and-forget product analytics.
 * Never throws, never blocks the UI. Rows land in the `events` table
 * (schema-v4.sql); `user_id` defaults to auth.uid() server-side.
 */
export function logEvent(
  name: string,
  props: Record<string, unknown> = {},
  screen = ""
) {
  try {
    void supabase()
      .from("events")
      .insert({ name, props, screen })
      .then(
        () => {},
        () => {}
      );
  } catch {
    /* analytics must never break the app */
  }
}
