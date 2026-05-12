# Guard QR Scanner App

Small Expo/React Native app for guard patrol QR scanning.

## What It Does

- Starts a guard NIGHT shift with guard name and ID.
- Scans configured patrol QR codes.
- Tracks one scan per point per hour.
- Supports 10 patrol points: `GUARDPATROL_QR_P1` through `GUARDPATROL_QR_P10`.
- Stores patrol records locally in `patrol_hour_records_v1`.
- Syncs finalized patrol records to Google Sheets with payload kind `patrol_hour_records_v1`.

There is no time-window restriction; scans can happen at any hour after a shift starts.

## Run

```bash
pnpm install
pnpm start -- --clear
```

Then open the app with Expo Go.

## Checks

```bash
pnpm typecheck
```

## Key Files

- `src/config/patrolConfig.ts` - patrol point QR values.
- `src/screens/ShiftScreen.tsx` - guard shift start screen.
- `src/screens/PatrolScreen.tsx` - QR scan UI and patrol progress.
- `src/storage/patrol.ts` - local patrol record model.
- `src/sync/sheets.ts` - Google Sheets sync.
- `src/constants/sheets.ts` - Apps Script sync URL/token config.
