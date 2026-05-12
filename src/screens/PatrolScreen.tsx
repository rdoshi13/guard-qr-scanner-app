import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { Camera, CameraView } from "expo-camera";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { AppButton } from "../components/AppButton";
import { PATROL_CONFIG } from "../config/patrolConfig";
import { useSession } from "../context/SessionContext";
import {
  applyScan,
  cleanupInvalidPatrolHourRecords,
  cleanupSyncedOlderThan,
  finalizeHourRecord,
  loadPatrolHourRecords,
  localDateKey,
  PatrolHourRecord,
  upsertHourRecord,
} from "../storage/patrol";
import { SHEETS_SYNC_CONFIG } from "../constants/sheets";
import { syncPatrolHourRecords } from "../sync/sheets";

function formatDateTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function hourLabel(hourStart: number): string {
  const end = (hourStart + 1) % 24;
  return `${String(hourStart).padStart(2, "0")}:00-${String(end).padStart(
    2,
    "0",
  )}:00`;
}

function currentWindowLabel(now: Date): string {
  return `${localDateKey(now)} ${String(now.getHours()).padStart(2, "0")}:00-${String(
    now.getHours() + 1,
  ).padStart(2, "0")}:00`;
}

export const PatrolScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { session, endSession } = useSession();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hourRecords, setHourRecords] = useState<PatrolHourRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const scanLockRef = useRef(false);

  const checkpoints = PATROL_CONFIG.points;

  const refreshRecords = useCallback(async () => {
    await cleanupInvalidPatrolHourRecords();
    await cleanupSyncedOlderThan(7);
    const all = await loadPatrolHourRecords();
    setHourRecords(all);
  }, []);

  useEffect(() => {
    Camera.requestCameraPermissionsAsync()
      .then(({ status }) => setHasPermission(status === "granted"))
      .catch(() => setHasPermission(false));
  }, []);

  useEffect(() => {
    refreshRecords().catch(() => {});
  }, [refreshRecords]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (scanning) {
          setScanning(false);
          setTorchOn(false);
          setIsProcessingScan(false);
          scanLockRef.current = false;
          return true;
        }

        navigation.navigate("Shift");
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => subscription.remove();
    }, [navigation, scanning]),
  );

  const now = new Date();
  const canPatrolNow = !!session;

  const tonightRecords = useMemo(() => {
    if (!session) return [];
    const patrolDate = localDateKey();
    return hourRecords
      .filter((r) => r.dateKey === patrolDate && r.guardId === session.guardId)
      .sort((a, b) => a.hourStart - b.hourStart);
  }, [hourRecords, session]);

  const currentHourRecord = useMemo(() => {
    if (!session) return undefined;
    return tonightRecords.find((r) => r.hourStart === new Date().getHours());
  }, [session, tonightRecords]);

  const completedCount = currentHourRecord?.completedCount ?? 0;

  const displayHours = useMemo(() => {
    const hours = new Set<number>([new Date().getHours()]);
    tonightRecords.forEach((record) => hours.add(record.hourStart));
    return Array.from(hours).sort((a, b) => a - b);
  }, [tonightRecords]);

  const ensurePatrolAllowed = (): boolean => {
    if (!session) {
      Alert.alert("No active shift", "Start a NIGHT shift before scanning.");
      return false;
    }

    return true;
  };

  const startScan = () => {
    if (!ensurePatrolAllowed()) return;

    if (hasPermission === false) {
      Alert.alert(
        "Camera blocked",
        "Camera permission is required to scan patrol QR codes.",
      );
      return;
    }

    setScanning(true);
    setIsProcessingScan(false);
    scanLockRef.current = false;
  };

  const manualSync = async () => {
    if (isSyncing) return;

    try {
      setIsSyncing(true);
      const result = await syncPatrolHourRecords(SHEETS_SYNC_CONFIG);

      if (!result.ok) {
        Alert.alert("Sync failed", result.message ?? "Sync did not complete.");
        return;
      }

      if (result.attempted === 0) {
        Alert.alert("Sync complete", "No pending patrol records.");
      } else {
        Alert.alert(
          "Sync complete",
          `Attempted: ${result.attempted}\nSynced: ${result.synced}\nSkipped: ${result.skipped}`,
        );
      }

      await refreshRecords();
    } catch (e: any) {
      Alert.alert("Sync failed", String(e?.message ?? e));
    } finally {
      setIsSyncing(false);
    }
  };

  const finishScanAttempt = () => {
    setScanning(false);
    setTorchOn(false);
    setIsProcessingScan(false);
    scanLockRef.current = false;
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanLockRef.current || !scanning) return;

    if (!ensurePatrolAllowed()) {
      finishScanAttempt();
      return;
    }

    if (!session) return;

    scanLockRef.current = true;
    setIsProcessingScan(true);

    const matched = checkpoints.find((c) => c.qrValue === data);
    if (!matched) {
      Alert.alert(
        "Invalid QR code",
        "This QR code is not one of the configured Rosedale patrol points.",
        [{ text: "OK", onPress: finishScanAttempt }],
      );
      return;
    }

    const scanTime = new Date();
    const record = await upsertHourRecord({
      society: PATROL_CONFIG.society,
      guardId: session.guardId,
      guardName: session.guardName,
      dateKey: localDateKey(scanTime),
      hourStart: scanTime.getHours(),
    });

    if (record.scans[matched.point]) {
      Alert.alert(
        "Already scanned",
        `${matched.label} has already been scanned for this hour.`,
        [{ text: "OK", onPress: finishScanAttempt }],
      );
      return;
    }

    const updated = await applyScan({
      recordId: record.id,
      point: matched.point,
      qrData: matched.qrValue,
    });

    if (updated && updated.completedCount === checkpoints.length) {
      await finalizeHourRecord({ recordId: updated.id, status: "COMPLETED" });
    }

    await refreshRecords();
    Vibration.vibrate(150);

    if (updated && updated.completedCount === checkpoints.length) {
      Alert.alert(
        "Hour complete",
        `All ${checkpoints.length} patrol points have been scanned for this hour.`,
        [{ text: "OK", onPress: finishScanAttempt }],
      );
      return;
    }

    Alert.alert("Scan saved", `${matched.label} recorded.`, [
      { text: "OK", onPress: finishScanAttempt },
    ]);
  };

  if (!session) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.title}>QR Patrol</Text>
        <Text style={styles.infoText}>Start a shift before scanning.</Text>
        <View style={styles.centerButton}>
          <AppButton
            title="Start shift"
            onPress={() => navigation.navigate("Shift")}
          />
        </View>
      </View>
    );
  }

  if (scanning) {
    return (
      <View style={styles.scannerContainer}>
        <Text style={styles.scannerTitle}>Scan patrol checkpoint QR</Text>

        {hasPermission === false ? (
          <Text style={styles.infoText}>
            Camera permission is required to scan QR codes.
          </Text>
        ) : (
          <View style={styles.scannerBox}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              onBarcodeScanned={
                isProcessingScan ? undefined : handleBarCodeScanned
              }
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
              enableTorch={torchOn}
            />
          </View>
        )}

        <View style={styles.scannerActions}>
          <View style={styles.actionColumn}>
            <AppButton
              title={torchOn ? "Torch off" : "Torch on"}
              onPress={() => setTorchOn((prev) => !prev)}
              variant="secondary"
            />
          </View>
          <View style={styles.actionColumn}>
            <AppButton
              title="Cancel"
              onPress={finishScanAttempt}
              variant="secondary"
            />
          </View>
        </View>
      </View>
    );
  }

  const recordForHour = (hourStart: number) => {
    return tonightRecords.find((r) => r.hourStart === hourStart);
  };

  const statusLabel = (status?: string) => {
    if (!status) return "Not started";
    if (status === "COMPLETED") return "Completed";
    if (status === "MISSED") return "Missed";
    return "In progress";
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>QR Patrol</Text>
          <Text style={styles.headerMeta}>Rosedale NIGHT shift</Text>
        </View>
        <View style={styles.headerRight}>
          {isSyncing ? (
            <ActivityIndicator />
          ) : (
            <AppButton title="Sync" onPress={manualSync} variant="secondary" />
          )}
        </View>
      </View>

      <View style={styles.shiftCard}>
        <Text style={styles.shiftTitle}>{session.guardName}</Text>
        <Text style={styles.shiftText}>Guard ID: {session.guardId}</Text>
        <Text style={styles.shiftText}>
          Started: {formatDateTime(session.startedAt)}
        </Text>
      </View>

      <View style={styles.scanButtonWrap}>
        <AppButton
          title="Scan QR"
          onPress={startScan}
          disabled={!canPatrolNow || hasPermission === null}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Current hour</Text>
        <Text style={styles.sectionMeta}>{currentWindowLabel(now)}</Text>
      </View>

      <View
        style={[
          styles.summaryCard,
          completedCount === checkpoints.length && styles.summaryCardCompleted,
        ]}
      >
        <Text style={styles.summaryText}>
          Completed: {completedCount} / {checkpoints.length}
        </Text>
      </View>

      {checkpoints.map((point) => {
        const last = currentHourRecord?.scans[point.point]?.scannedAt;
        return (
          <View key={point.id} style={styles.checkpointCard}>
            <View style={styles.checkpointCopy}>
              <Text style={styles.checkpointName}>{point.label}</Text>
              <Text style={styles.checkpointInfo}>
                Last scan: {last ? formatDateTime(last) : "Not scanned"}
              </Text>
            </View>
            <View style={[styles.scanPill, last && styles.scanPillDone]}>
              <Text style={[styles.scanPillText, last && styles.scanPillTextDone]}>
                {last ? "OK" : "--"}
              </Text>
            </View>
          </View>
        );
      })}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Today</Text>
      </View>

      <View style={styles.hourGrid}>
        {displayHours.map((hourStart) => {
          const record = recordForHour(hourStart);
          const isDone = record?.status === "COMPLETED";
          const isMissed = record?.status === "MISSED";

          return (
            <View
              key={hourStart}
              style={[
                styles.hourCard,
                isDone && styles.hourCardDone,
                isMissed && styles.hourCardMissed,
              ]}
            >
              <Text style={styles.hourTitle}>{hourLabel(hourStart)}</Text>
              <Text style={styles.hourMeta}>{statusLabel(record?.status)}</Text>
              <Text style={styles.hourMeta}>
                Points: {record?.completedCount ?? 0} / {checkpoints.length}
              </Text>
            </View>
          );
        })}
      </View>

      <AppButton title="End shift" onPress={endSession} variant="danger" />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "#f7f9fc",
  },
  centerButton: {
    width: "100%",
    marginTop: 18,
  },
  container: {
    flex: 1,
    backgroundColor: "#f7f9fc",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerRight: {
    minWidth: 88,
    alignItems: "flex-end",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#102a43",
  },
  headerMeta: {
    marginTop: 2,
    fontSize: 13,
    color: "#627d98",
  },
  infoText: {
    fontSize: 16,
    marginTop: 8,
    textAlign: "center",
    color: "#52606d",
  },
  shiftCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    marginBottom: 12,
  },
  shiftTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#102a43",
  },
  shiftText: {
    fontSize: 14,
    color: "#334e68",
    marginTop: 4,
  },
  windowNotice: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    marginBottom: 12,
  },
  windowNoticeText: {
    fontSize: 14,
    color: "#92400e",
  },
  scanButtonWrap: {
    marginBottom: 16,
  },
  sectionHeader: {
    marginTop: 4,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#243b53",
  },
  sectionMeta: {
    marginTop: 2,
    fontSize: 12,
    color: "#627d98",
  },
  summaryCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    marginBottom: 10,
  },
  summaryCardCompleted: {
    backgroundColor: "#dcfce7",
    borderColor: "#16a34a",
  },
  summaryText: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    color: "#102a43",
  },
  checkpointCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9e2ec",
    backgroundColor: "#ffffff",
    marginBottom: 8,
  },
  checkpointCopy: {
    flex: 1,
  },
  checkpointName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#102a43",
  },
  checkpointInfo: {
    fontSize: 14,
    marginTop: 4,
    color: "#52606d",
  },
  scanPill: {
    width: 46,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    marginLeft: 12,
  },
  scanPillDone: {
    backgroundColor: "#dcfce7",
    borderColor: "#16a34a",
  },
  scanPillText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748b",
  },
  scanPillTextDone: {
    color: "#166534",
  },
  hourGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  hourCard: {
    width: "48%",
    minHeight: 86,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#ffffff",
    marginBottom: 10,
  },
  hourCardDone: {
    backgroundColor: "#dcfce7",
    borderColor: "#16a34a",
  },
  hourCardMissed: {
    backgroundColor: "#fee2e2",
    borderColor: "#dc2626",
  },
  hourTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#102a43",
  },
  hourMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#52606d",
  },
  scannerContainer: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
    color: "#ffffff",
  },
  scannerBox: {
    width: "100%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "#111827",
  },
  scannerActions: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  actionColumn: {
    flex: 1,
    marginHorizontal: 4,
  },
});
