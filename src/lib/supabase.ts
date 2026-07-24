import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. .env.local을 확인하세요."
  );
}

// Server-only client using the service role key. Never import this from a
// Client Component — every table has RLS enabled with no policies, so only
// this key (which bypasses RLS) can read or write. All authorization
// (checking the caller's role/id) happens in application code before these
// queries run.
export const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
