import { createClient } from "@supabase/supabase-js";
import { env } from "./env";
import ws from "ws";

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  realtime: {
    transport: ws as any
  }
});



