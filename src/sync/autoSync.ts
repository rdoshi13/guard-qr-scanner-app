import { SUPABASE_SYNC_CONFIG } from "../constants/supabase";
import { SyncConfig, SyncResult, syncPatrolHourRecords } from "./supabase";

let activeRun: Promise<SyncResult> | null = null;

async function runInternal(cfg: SyncConfig): Promise<SyncResult> {
  return syncPatrolHourRecords(cfg);
}

export async function runAutoSyncIfDue(
  cfg: SyncConfig = SUPABASE_SYNC_CONFIG,
): Promise<SyncResult> {
  if (activeRun) return activeRun;

  activeRun = runInternal(cfg).finally(() => {
    activeRun = null;
  });

  return activeRun;
}
