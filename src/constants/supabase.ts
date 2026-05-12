export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const SUPABASE_SYNC_CONFIG = {
  url: SUPABASE_URL || "",
  anonKey: SUPABASE_ANON_KEY || "",
  tableName:
    process.env.EXPO_PUBLIC_SUPABASE_PATROL_TABLE || "patrol_hour_records",
};
