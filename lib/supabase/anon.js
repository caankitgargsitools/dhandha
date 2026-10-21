import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../config";

// No user session: for webhooks and workers whose calls are authorised inside the database (signature or worker key).
export const anonClient = () => createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
