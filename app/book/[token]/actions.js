"use server";
import { anonClient } from "@/lib/supabase/anon";

// The client confirms a time; the database re-checks it and books a free salesperson (book_by_token).
export async function bookByToken({ token, start, note }) {
  if (!/^[0-9a-f-]{36}$/i.test(String(token)) || !start) return { error: "Please pick a time." };
  const { data, error } = await anonClient().rpc("book_by_token", { p_token: token, p_start: start, p_note: String(note || "").slice(0, 500) });
  if (error) return { error: error.message };
  return data;
}
