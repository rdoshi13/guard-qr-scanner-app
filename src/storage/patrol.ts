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
  societyId: string;
  society: string;
  guardId: string;
  guardName: string;
  dateKey: string;
  hourStart: number;
  hourWindow?: string;
  scans: Record<PatrolPoint, PatrolScan | null>;
  completedCount: number;
  status: PatrolStatus;
  createdAt: string;
  finalizedAt?: string;
  syncedAt?: string;
};

export type PatrolSyncRow = {
  dateKey: string;
  hourStart: number;
  hourWindow: string;
  societyId: string;
  society: string;
  guardId: string;
  guardName: string;
  status: "COMPLETED" | "MISSED" | "IN_PROGRESS";
  recordId: string;
  completedCount: number;
  totalPoints: number;
  pointsScanned: string[];
  scans: Record<string, PatrolScan>;
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

function normalizeRecordIdPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function makePatrolRecordId(input: {
  societyId: string;
  dateKey: string;
  hourStart: number;
  guardId: string;
}): string {
  return [
    normalizeRecordIdPart(input.societyId),
    input.dateKey,
    String(input.hourStart).padStart(2, "0"),
    normalizeRecordIdPart(input.guardId),
  ].join("|");
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
  societyId: string;
  society: string;
  guardId: string;
  guardName: string;
  dateKey: string;
  hourStart: number;
  hourWindow: string;
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
      (r.societyId ?? "") === input.societyId &&
      r.guardId === input.guardId,
  );

  if (existing) return existing;

  const created: PatrolHourRecord = {
    id: makePatrolRecordId({
      societyId: input.societyId,
      dateKey: input.dateKey,
      hourStart: input.hourStart,
      guardId: input.guardId,
    }),
    societyId: input.societyId,
    society: input.society,
    guardId: input.guardId,
    guardName: input.guardName,
    dateKey: input.dateKey,
    hourStart: input.hourStart,
    hourWindow: input.hourWindow,
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
    syncedAt: undefined,
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
    syncedAt: undefined,
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
      (r.status === "IN_PROGRESS" ||
        r.status === "COMPLETED" ||
        r.status === "MISSED"),
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

  let normalized = false;
  const next = all
    .filter((r) => isValidPatrolHourStart(r.hourStart))
    .map((r) => {
      if (r.societyId) return r;
      normalized = true;
      return {
        ...r,
        societyId: normalizeRecordIdPart(r.society),
      };
    });
  const removed = all.length - next.length;

  if (removed > 0 || normalized) {
    await savePatrolHourRecords(next);
  }

  return removed;
}

function formatHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const suffix = normalized >= 12 ? "PM" : "AM";
  const display = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${display}:00 ${suffix}`;
}

function hourWindowLabel(hourStart: number): string {
  return `${formatHour(hourStart)} - ${formatHour(hourStart + 1)}`;
}

function pointsScannedList(scans: PatrolHourRecord["scans"]): string[] {
  const points: string[] = [];
  (Object.keys(scans) as unknown as PatrolPoint[]).forEach((k) => {
    if (scans[k]) points.push(String(k));
  });

  points.sort((a, b) => Number(a) - Number(b));
  return points;
}

function completedScans(
  scans: PatrolHourRecord["scans"],
): Record<string, PatrolScan> {
  const output: Record<string, PatrolScan> = {};
  (Object.keys(scans) as unknown as PatrolPoint[]).forEach((k) => {
    const scan = scans[k];
    if (scan) output[String(k)] = scan;
  });
  return output;
}

export function patrolRecordToSyncRow(r: PatrolHourRecord): PatrolSyncRow {
  return {
    dateKey: r.dateKey,
    hourStart: r.hourStart,
    hourWindow: r.hourWindow ?? hourWindowLabel(r.hourStart),
    societyId: r.societyId,
    society: r.society,
    guardId: r.guardId,
    guardName: r.guardName,
    status: r.status,
    recordId: r.id,
    completedCount: r.completedCount,
    totalPoints: Object.keys(r.scans).length,
    pointsScanned: pointsScannedList(r.scans),
    scans: completedScans(r.scans),
    createdAt: r.createdAt,
    finalizedAt: r.finalizedAt ?? "",
  };
}
