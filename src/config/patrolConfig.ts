export type PatrolPointConfig = {
  id: string;
  label: string;
  qrValue: string;
  point: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
};

export const PATROL_CONFIG = {
  society: "Vihav Trade Center",
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
