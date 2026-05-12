import AsyncStorage from "@react-native-async-storage/async-storage";

export type PatrolPoint = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type PatrolStatus = "IN_PROGRESS" | "COMPLETED" | "MISSED";

export type PatrolScan = {
  point: PatrolPoint;
  qrData: string;
  scannedAt: string;
};

export type PatrolHourRecord = {
  id: string;
  society: string;
  guardId: string;
  guardName: string;
  dateKey: string;
  hourStart: number;
  scans: Record<PatrolPoint, PatrolScan | null>;
  completedCount: number;
  status: PatrolStatus;
  createdAt: string;
  finalizedAt?: string;
  syncedAt?: string;
};

export type PatrolSheetRow = {
  dateKey: string;
  hourWindow: string;
  society: string;
  guardId: string;
  guardName: string;
  status: "COMPLETED" | "MISSED" | "IN_PROGRESS";
  recordId: string;
  completedCount: number;
  pointsScanned: string;
  createdAt: string;
  finalizedAt: string;
};

const KEY = "patrol_hour_records_v1";
const MIN_PATROL_HOUR_START = 0;
const MAX_PATROL_HOUR_START = 23;

function isValidPatrolHourStart(hourStart: number): boolean {
  return (
    Number.isInteger(hourStart) &&
    hourStart >= MIN_PATROL_HOUR_START &&
    hourStart <= MAX_PATROL_HOUR_START
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix: string = "phr"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptyScans(): Record<PatrolPoint, PatrolScan | null> {
  return {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null,
    8: null,
    9: null,
    10: null,
  };
}

export function countCompleted(
  scans: Record<PatrolPoint, PatrolScan | null>,
): number {
  let count = 0;
  (Object.keys(scans) as unknown as PatrolPoint[]).forEach((k) => {
    if (scans[k]) count += 1;
  });
  return count;
}

export async function loadPatrolHourRecords(): Promise<PatrolHourRecord[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PatrolHourRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePatrolHourRecords(
  records: PatrolHourRecord[],
): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(records));
}

export async function upsertHourRecord(input: {
  society: string;
  guardId: string;
  guardName: string;
  dateKey: string;
  hourStart: number;
}): Promise<PatrolHourRecord> {
  if (!isValidPatrolHourStart(input.hourStart)) {
    throw new Error(
      `Invalid patrol hourStart: ${input.hourStart}. Expected 0..23.`,
    );
  }

  const all = await loadPatrolHourRecords();
  const existing = all.find(
    (r) =>
      r.dateKey === input.dateKey &&
      r.hourStart === input.hourStart &&
      r.guardId === input.guardId,
  );

  if (existing) return existing;

  const created: PatrolHourRecord = {
    id: makeId(),
    society: input.society,
    guardId: input.guardId,
    guardName: input.guardName,
    dateKey: input.dateKey,
    hourStart: input.hourStart,
    scans: emptyScans(),
    completedCount: 0,
    status: "IN_PROGRESS",
    createdAt: nowIso(),
    syncedAt: undefined,
  };

  const updated = [created, ...all];
  await savePatrolHourRecords(updated);
  return created;
}

export async function applyScan(args: {
  recordId: string;
  point: PatrolPoint;
  qrData: string;
}): Promise<PatrolHourRecord | null> {
  const all = await loadPatrolHourRecords();
  const idx = all.findIndex((r) => r.id === args.recordId);
  if (idx === -1) return null;

  const record = all[idx];
  if (record.finalizedAt || record.status !== "IN_PROGRESS") {
    return record;
  }

  if (record.scans[args.point]) return record;

  const nextScans = {
    ...record.scans,
    [args.point]: {
      point: args.point,
      qrData: args.qrData,
      scannedAt: nowIso(),
    },
  } as PatrolHourRecord["scans"];

  const next: PatrolHourRecord = {
    ...record,
    scans: nextScans,
    completedCount: countCompleted(nextScans),
  };

  all[idx] = next;
  await savePatrolHourRecords(all);
  return next;
}

export async function finalizeHourRecord(args: {
  recordId: string;
  status: "COMPLETED" | "MISSED";
}): Promise<PatrolHourRecord | null> {
  const all = await loadPatrolHourRecords();
  const idx = all.findIndex((r) => r.id === args.recordId);
  if (idx === -1) return null;

  const record = all[idx];
  const next: PatrolHourRecord = {
    ...record,
    status: args.status,
    finalizedAt: nowIso(),
    syncedAt: record.syncedAt ?? undefined,
  };

  all[idx] = next;
  await savePatrolHourRecords(all);
  return next;
}

export async function getUnsyncedHourRecords(): Promise<PatrolHourRecord[]> {
  const all = await loadPatrolHourRecords();
  return all.filter(
    (r) =>
      isValidPatrolHourStart(r.hourStart) &&
      !r.syncedAt &&
      !!r.finalizedAt &&
      (r.status === "COMPLETED" || r.status === "MISSED"),
  );
}

export async function markHourRecordsSynced(
  recordIds: string[],
): Promise<void> {
  if (recordIds.length === 0) return;

  const all = await loadPatrolHourRecords();
  const set = new Set(recordIds);
  const syncedAt = nowIso();
  const next = all.map((r) => (set.has(r.id) ? { ...r, syncedAt } : r));
  await savePatrolHourRecords(next);
}

export async function cleanupSyncedOlderThan(days: number = 7): Promise<void> {
  const all = await loadPatrolHourRecords();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const next = all.filter((r) => {
    if (!r.syncedAt) return true;
    const t = Date.parse(r.syncedAt);
    if (Number.isNaN(t)) return true;
    return t >= cutoff;
  });

  if (next.length !== all.length) {
    await savePatrolHourRecords(next);
  }
}

export async function cleanupInvalidPatrolHourRecords(): Promise<number> {
  const all = await loadPatrolHourRecords();
  if (all.length === 0) return 0;

  const next = all.filter((r) => isValidPatrolHourStart(r.hourStart));
  const removed = all.length - next.length;

  if (removed > 0) {
    await savePatrolHourRecords(next);
  }

  return removed;
}

function hourWindowLabel(hourStart: number): string {
  const start = `${String(hourStart).padStart(2, "0")}:00`;
  const end = `${String((hourStart + 1) % 24).padStart(2, "0")}:00`;
  return `${start}-${end}`;
}

function pointsScannedList(scans: PatrolHourRecord["scans"]): string {
  const points: number[] = [];
  (Object.keys(scans) as unknown as PatrolPoint[]).forEach((k) => {
    if (scans[k]) points.push(Number(k));
  });

  points.sort((a, b) => a - b);
  return points.join(",");
}

export function patrolRecordToSheetRow(r: PatrolHourRecord): PatrolSheetRow {
  return {
    dateKey: r.dateKey,
    hourWindow: hourWindowLabel(r.hourStart),
    society: r.society,
    guardId: r.guardId,
    guardName: r.guardName,
    status: r.status,
    recordId: r.id,
    completedCount: r.completedCount,
    pointsScanned: pointsScannedList(r.scans),
    createdAt: r.createdAt,
    finalizedAt: r.finalizedAt ?? "",
  };
}
