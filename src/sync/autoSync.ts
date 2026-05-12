import AsyncStorage from "@react-native-async-storage/async-storage";

import { SHEETS_SYNC_CONFIG } from "../constants/sheets";
import { SyncConfig, SyncResult, syncPatrolHourRecords } from "./sheets";

const LAST_SYNC_PATROL_KEY = "last_sync_patrol_at_v1";

let activeRun: Promise<SyncResult> | null = null;

function parseIsoMs(iso: string | null): number | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  return Number.isNaN(ts) ? null : ts;
}

function latestPatrolSlot(now: Date): Date {
  const slot0530 = new Date(now);
  slot0530.setHours(5, 30, 0, 0);

  const slot2330 = new Date(now);
  slot2330.setHours(23, 30, 0, 0);

  if (now.getTime() >= slot2330.getTime()) {
    return slot2330;
  }

  if (now.getTime() >= slot0530.getTime()) {
    return slot0530;
  }

  const yesterday2330 = new Date(slot2330);
  yesterday2330.setDate(yesterday2330.getDate() - 1);
  return yesterday2330;
}

function dueBySlot(lastSyncIso: string | null, slot: Date): boolean {
  const ts = parseIsoMs(lastSyncIso);
  if (ts === null) return true;
  return ts < slot.getTime();
}

async function runInternal(cfg: SyncConfig): Promise<SyncResult> {
  const lastPatrol = await AsyncStorage.getItem(LAST_SYNC_PATROL_KEY);
  const now = new Date();

  if (!dueBySlot(lastPatrol, latestPatrolSlot(now))) {
    return { ok: true, attempted: 0, synced: 0, skipped: 0 };
  }

  const patrol = await syncPatrolHourRecords(cfg);
  if (patrol.ok) {
    await AsyncStorage.setItem(
      LAST_SYNC_PATROL_KEY,
      new Date().toISOString(),
    );
  }

  return patrol;
}

export async function runAutoSyncIfDue(
  cfg: SyncConfig = SHEETS_SYNC_CONFIG,
): Promise<SyncResult> {
  if (activeRun) return activeRun;

  activeRun = runInternal(cfg).finally(() => {
    activeRun = null;
  });

  return activeRun;
}
