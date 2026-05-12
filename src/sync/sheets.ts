import {
  cleanupInvalidPatrolHourRecords,
  cleanupSyncedOlderThan,
  getUnsyncedHourRecords,
  markHourRecordsSynced,
  patrolRecordToSheetRow,
} from "../storage/patrol";

export type SyncResult = {
  ok: boolean;
  attempted: number;
  synced: number;
  skipped: number;
  message?: string;
};

export type SyncConfig = {
  url: string;
  token?: string;
  timeoutMs?: number;
};

type PushRowsResult = SyncResult & {
  remoteInserted: number;
  remoteSkipped: number;
};

async function requestWithTimeout(
  url: string,
  init: Omit<RequestInit, "signal">,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function withToken(url: string, token?: string): string {
  if (!token) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithSilentRetry(
  url: string,
  init: Omit<RequestInit, "signal">,
  timeoutMs: number,
  attempts: number,
): Promise<Response> {
  let lastErr: unknown = null;

  for (let i = 0; i < attempts; i += 1) {
    try {
      if (i > 0) {
        const base = 800 * 2 ** (i - 1);
        const jitter = Math.floor(Math.random() * 250);
        await sleep(base + jitter);
      }

      return await requestWithTimeout(url, init, timeoutMs);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr ?? new Error("Request failed");
}

function parseRemoteAck(payloadText: string): {
  remoteOk: boolean;
  inserted: number;
  skipped: number;
  message?: string;
} {
  let payload: any = null;
  try {
    payload = payloadText ? JSON.parse(payloadText) : null;
  } catch {
    payload = null;
  }

  return {
    remoteOk: payload?.ok === true || payload?.success === true,
    inserted: typeof payload?.inserted === "number" ? payload.inserted : -1,
    skipped: typeof payload?.skipped === "number" ? payload.skipped : 0,
    message:
      typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error === "string"
          ? payload.error
          : payloadText || undefined,
  };
}

async function pushRows(
  recordIds: string[],
  rows: any[],
  cfg: SyncConfig,
): Promise<PushRowsResult> {
  const timeoutMs = cfg.timeoutMs ?? 12_000;

  if (recordIds.length === 0 || rows.length === 0) {
    return {
      ok: true,
      attempted: 0,
      synced: 0,
      skipped: 0,
      remoteInserted: 0,
      remoteSkipped: 0,
    };
  }

  const body = {
    kind: "patrol_hour_records_v1",
    token: cfg.token,
    recordIds,
    rows,
  };

  try {
    const res = await postWithSilentRetry(
      withToken(cfg.url, cfg.token),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
      3,
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        attempted: recordIds.length,
        synced: 0,
        skipped: 0,
        remoteInserted: 0,
        remoteSkipped: 0,
        message: `HTTP ${res.status} ${text}`.trim(),
      };
    }

    const payloadText = await res.text().catch(() => "");
    const ack = parseRemoteAck(payloadText);
    if (!ack.remoteOk) {
      return {
        ok: false,
        attempted: recordIds.length,
        synced: 0,
        skipped: 0,
        remoteInserted: 0,
        remoteSkipped: 0,
        message: ack.message || "Remote did not confirm success",
      };
    }

    const remoteInserted =
      ack.inserted >= 0 ? ack.inserted : recordIds.length - ack.skipped;
    const remoteSkipped = Math.max(0, ack.skipped);
    const safeSynced = Math.min(
      recordIds.length,
      Math.max(0, remoteInserted + remoteSkipped),
    );

    return {
      ok: true,
      attempted: recordIds.length,
      synced: safeSynced,
      skipped: remoteSkipped,
      remoteInserted,
      remoteSkipped,
      message: ack.message,
    };
  } catch (e: any) {
    return {
      ok: false,
      attempted: recordIds.length,
      synced: 0,
      skipped: 0,
      remoteInserted: 0,
      remoteSkipped: 0,
      message:
        e?.name === "AbortError"
          ? "Sync request timed out"
          : (e?.message ?? String(e)),
    };
  }
}

export async function syncPatrolHourRecords(
  cfg: SyncConfig,
): Promise<SyncResult> {
  await cleanupInvalidPatrolHourRecords();

  const records = await getUnsyncedHourRecords();
  if (records.length === 0) {
    return { ok: true, attempted: 0, synced: 0, skipped: 0 };
  }

  const rows = records.map(patrolRecordToSheetRow);
  const recordIds = records.map((r) => r.id);
  const pushed = await pushRows(recordIds, rows, cfg);

  if (!pushed.ok) {
    return pushed;
  }

  if (pushed.synced === recordIds.length) {
    await markHourRecordsSynced(recordIds);
    await cleanupSyncedOlderThan(7);
    return pushed;
  }

  return {
    ...pushed,
    ok: false,
    message: "Partial patrol sync confirmation; local records left unsynced.",
  };
}
