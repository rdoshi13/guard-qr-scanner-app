export type Language = "en" | "gu";

type StringKey =
  | "activeShift"
  | "alreadyScannedMessage"
  | "alreadyScannedTitle"
  | "back"
  | "cameraBlockedMessage"
  | "cameraBlockedTitle"
  | "cameraPermissionMissing"
  | "cancel"
  | "completed"
  | "continueScanning"
  | "currentHour"
  | "endShift"
  | "ended"
  | "english"
  | "enterGuardId"
  | "enterGuardName"
  | "gujarati"
  | "guardId"
  | "guardName"
  | "hourCompleteMessage"
  | "hourCompleteTitle"
  | "inProgress"
  | "invalidQrMessage"
  | "invalidQrTitle"
  | "language"
  | "lastScan"
  | "lastShift"
  | "missingDetailsMessage"
  | "missingDetailsTitle"
  | "missed"
  | "noActiveShiftMessage"
  | "noActiveShiftTitle"
  | "notScanned"
  | "notStarted"
  | "ok"
  | "patrolTitle"
  | "points"
  | "scanPrompt"
  | "scanQr"
  | "scanSavedMessage"
  | "scanSavedTitle"
  | "scannerTitle"
  | "shiftScreenTitle"
  | "started"
  | "startShift"
  | "startShiftSubtitle"
  | "startShiftTitle"
  | "today"
  | "torchOff"
  | "torchOn";

const STRINGS: Record<Language, Record<StringKey, string>> = {
  en: {
    activeShift: "Active shift",
    alreadyScannedMessage: "{point} has already been scanned for this hour.",
    alreadyScannedTitle: "Already scanned",
    back: "Back",
    cameraBlockedMessage:
      "Camera permission is required to scan patrol QR codes.",
    cameraBlockedTitle: "Camera blocked",
    cameraPermissionMissing: "Camera permission is required to scan QR codes.",
    cancel: "Cancel",
    completed: "Completed",
    continueScanning: "Continue scanning",
    currentHour: "Current hour",
    endShift: "End shift",
    ended: "Ended",
    english: "English",
    enterGuardId: "Enter guard ID",
    enterGuardName: "Enter guard name",
    gujarati: "Gujarati",
    guardId: "Guard ID",
    guardName: "Guard name",
    hourCompleteMessage:
      "All {count} patrol points have been scanned for this hour.",
    hourCompleteTitle: "Hour complete",
    inProgress: "In progress",
    invalidQrMessage:
      "This QR code is not one of the configured patrol points.",
    invalidQrTitle: "Invalid QR code",
    language: "Language",
    lastScan: "Last scan",
    lastShift: "Last shift",
    missingDetailsMessage: "Enter a guard name and guard ID.",
    missingDetailsTitle: "Missing details",
    missed: "Missed",
    noActiveShiftMessage: "Start a shift before scanning.",
    noActiveShiftTitle: "No active shift",
    notScanned: "Not scanned",
    notStarted: "Not started",
    ok: "OK",
    patrolTitle: "Guard Patrol Scanner",
    points: "Points",
    scanPrompt: "Scan patrol checkpoint QR",
    scanQr: "Scan QR",
    scanSavedMessage: "{point} recorded.",
    scanSavedTitle: "Scan saved",
    scannerTitle: "QR Patrol",
    shiftScreenTitle: "Start Shift",
    started: "Started",
    startShift: "Start shift",
    startShiftSubtitle:
      "Start a guard shift to scan patrol checkpoints throughout the day.",
    startShiftTitle: "QR Patrol",
    today: "Today",
    torchOff: "Torch off",
    torchOn: "Torch on",
  },
  gu: {
    activeShift: "ચાલુ શિફ્ટ",
    alreadyScannedMessage: "{point} આ કલાક માટે પહેલેથી સ્કેન થઈ ગયું છે.",
    alreadyScannedTitle: "પહેલેથી સ્કેન થયું",
    back: "પાછળ",
    cameraBlockedMessage: "ચોકી QR કોડ સ્કેન કરવા કેમેરાની પરવાનગી જરૂરી છે.",
    cameraBlockedTitle: "કેમેરા બ્લોક છે",
    cameraPermissionMissing: "QR કોડ સ્કેન કરવા કેમેરાની પરવાનગી જરૂરી છે.",
    cancel: "રદ કરો",
    completed: "પૂર્ણ",
    continueScanning: "સ્કેનિંગ ચાલુ રાખો",
    currentHour: "હાલનો કલાક",
    endShift: "શિફ્ટ સમાપ્ત કરો",
    ended: "સમાપ્ત",
    english: "English",
    enterGuardId: "ચોકીદાર ID દાખલ કરો",
    enterGuardName: "ચોકીદારનું નામ દાખલ કરો",
    gujarati: "ગુજરાતી",
    guardId: "ચોકીદાર ID",
    guardName: "ચોકીદારનું નામ",
    hourCompleteMessage: "આ કલાક માટે બધા {count} ચોકી પોઈન્ટ સ્કેન થઈ ગયા છે.",
    hourCompleteTitle: "કલાક પૂર્ણ",
    inProgress: "ચાલુ છે",
    invalidQrMessage: "આ QR કોડ સેટ કરેલા ચોકી પોઈન્ટમાંથી નથી.",
    invalidQrTitle: "ખોટો QR કોડ",
    language: "ભાષા",
    lastScan: "છેલ્લું સ્કેન",
    lastShift: "છેલ્લી શિફ્ટ",
    missingDetailsMessage: "ચોકીદારનું નામ અને ચોકીદાર ID દાખલ કરો.",
    missingDetailsTitle: "માહિતી બાકી છે",
    missed: "ચૂકી ગયું",
    noActiveShiftMessage: "સ્કેન કરતાં પહેલાં શિફ્ટ શરૂ કરો.",
    noActiveShiftTitle: "ચાલુ શિફ્ટ નથી",
    notScanned: "સ્કેન થયું નથી",
    notStarted: "શરૂ થયું નથી",
    ok: "બરાબર",
    patrolTitle: "ચોકી સ્કેનર",
    points: "પોઈન્ટ",
    scanPrompt: "ચોકી ચેકપોઈન્ટ QR સ્કેન કરો",
    scanQr: "QR સ્કેન કરો",
    scanSavedMessage: "{point} સેવ થયું.",
    scanSavedTitle: "સ્કેન સેવ થયું",
    scannerTitle: "QR ચોકી",
    shiftScreenTitle: "શિફ્ટ શરૂ કરો",
    started: "શરૂ થયું",
    startShift: "શિફ્ટ શરૂ કરો",
    startShiftSubtitle:
      "દિવસભર ચોકી ચેકપોઈન્ટ સ્કેન કરવા ચોકીદાર શિફ્ટ શરૂ કરો.",
    startShiftTitle: "QR ચોકી",
    today: "આજે",
    torchOff: "ટોર્ચ બંધ",
    torchOn: "ટોર્ચ ચાલુ",
  },
};

export function t(
  language: Language,
  key: StringKey,
  vars: Record<string, string | number> = {},
): string {
  let text = STRINGS[language][key] ?? STRINGS.en[key];
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replace(`{${name}}`, String(value));
  });
  return text;
}
