export type PatrolPointConfig = {
  id: string;
  label: string;
  qrValue: string;
  point: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
};

export const PATROL_CONFIG = {
  societyId: "vihav_trade_center",
  society: "Vihav Trade Center",
  timeZone: "Asia/Kolkata",
  points: [
    {
      id: "p1",
      label: "Point 1",
      qrValue: "GUARDPATROL_QR_P1",
      point: 1,
    },
    {
      id: "p2",
      label: "Point 2",
      qrValue: "GUARDPATROL_QR_P2",
      point: 2,
    },
    {
      id: "p3",
      label: "Point 3",
      qrValue: "GUARDPATROL_QR_P3",
      point: 3,
    },
    {
      id: "p4",
      label: "Point 4",
      qrValue: "GUARDPATROL_QR_P4",
      point: 4,
    },
    {
      id: "p5",
      label: "Point 5",
      qrValue: "GUARDPATROL_QR_P5",
      point: 5,
    },
    {
      id: "p6",
      label: "Point 6",
      qrValue: "GUARDPATROL_QR_P6",
      point: 6,
    },
    {
      id: "p7",
      label: "Point 7",
      qrValue: "GUARDPATROL_QR_P7",
      point: 7,
    },
    {
      id: "p8",
      label: "Point 8",
      qrValue: "GUARDPATROL_QR_P8",
      point: 8,
    },
    {
      id: "p9",
      label: "Point 9",
      qrValue: "GUARDPATROL_QR_P9",
      point: 9,
    },
    {
      id: "p10",
      label: "Point 10",
      qrValue: "GUARDPATROL_QR_P10",
      point: 10,
    },
  ] satisfies PatrolPointConfig[],
};

function timeZoneParts(d: Date): { dateKey: string; hourStart: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PATROL_CONFIG.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hourRaw = Number(get("hour"));
  const hourStart = hourRaw === 24 ? 0 : hourRaw;

  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    hourStart,
  };
}

function formatHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const suffix = normalized >= 12 ? "PM" : "AM";
  const display = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${display}:00 ${suffix}`;
}

export function patrolDateKey(d: Date = new Date()): string {
  return timeZoneParts(d).dateKey;
}

export function patrolHourStart(d: Date = new Date()): number {
  return timeZoneParts(d).hourStart;
}

export function patrolHourWindow(hourStart: number): string {
  return `${formatHour(hourStart)} - ${formatHour(hourStart + 1)}`;
}
