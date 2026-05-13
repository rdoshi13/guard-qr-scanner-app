import {
  cleanupInvalidPatrolHourRecords,
  cleanupSyncedOlderThan,
  getUnsyncedHourRecords,
  markHourRecordsSynced,
  patrolRecordToSyncRow,
  PatrolSyncRow,
} from "../storage/patrol";
import { createSupabaseClient } from "../lib/supabase";

export type SyncResult = {
  ok: boolean;
  attempted: number;
  synced: number;
  skipped: number;
  message?: string;
};

export type SyncConfig = {
  url: string;
  anonKey: string;
  tableName: string;
};

function hasConfig(cfg: SyncConfig): boolean {
  return Boolean(cfg.url.trim() && cfg.anonKey.trim() && cfg.tableName.trim());
}

function toSupabaseRow(row: PatrolSyncRow) {
  return {
    record_id: row.recordId,
    date_key: row.dateKey,
    hour_start: row.hourStart,
    hour_window: row.hourWindow,
    society_id: row.societyId,
    society: row.society,
    guard_id: row.guardId,
    guard_name: row.guardName,
    status: row.status,
    completed_count: row.completedCount,
    total_points: row.totalPoints,
    points_scanned: row.pointsScanned,
    scans: row.scans,
    created_at: row.createdAt,
    finalized_at: row.finalizedAt || null,
    updated_at: new Date().toISOString(),
  };
}

export async function syncPatrolHourRecords(
  cfg: SyncConfig,
): Promise<SyncResult> {
  if (!hasConfig(cfg)) {
    return {
      ok: false,
      attempted: 0,
      synced: 0,
      skipped: 0,
      message:
        "Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  await cleanupInvalidPatrolHourRecords();

  const records = await getUnsyncedHourRecords();
  if (records.length === 0) {
    return { ok: true, attempted: 0, synced: 0, skipped: 0 };
  }

  const rows = records.map((record) =>
    toSupabaseRow(patrolRecordToSyncRow(record)),
  );
  const supabase = createSupabaseClient({
    url: cfg.url,
    anonKey: cfg.anonKey,
  });

  const { error } = await supabase
    .from(cfg.tableName)
    .upsert(rows, { onConflict: "record_id" });

  if (error) {
    return {
      ok: false,
      attempted: records.length,
      synced: 0,
      skipped: 0,
      message: error.message,
    };
  }

  await markHourRecordsSynced(records.map((record) => record.id));
  await cleanupSyncedOlderThan(7);

  return {
    ok: true,
    attempted: records.length,
    synced: records.length,
    skipped: 0,
  };
}
