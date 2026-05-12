import "react-native-url-polyfill/auto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseClient(args: {
  url: string;
  anonKey: string;
}): SupabaseClient {
  return createClient(args.url, args.anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
