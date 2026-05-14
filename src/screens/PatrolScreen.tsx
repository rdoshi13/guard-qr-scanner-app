import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  BackHandler,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { Camera, CameraView } from "expo-camera";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton } from "../components/AppButton";
import { useLanguage } from "../context/LanguageContext";
import {
  patrolDateKey,
  patrolHourStart,
  patrolHourWindow,
  PATROL_CONFIG,
} from "../config/patrolConfig";
import { useSession } from "../context/SessionContext";
import {
  applyScan,
  cleanupInvalidPatrolHourRecords,
  cleanupSyncedOlderThan,
  finalizeHourRecord,
  loadPatrolHourRecords,
  PatrolHourRecord,
  upsertHourRecord,
} from "../storage/patrol";
import { t } from "../i18n/strings";
import { SUPABASE_SYNC_CONFIG } from "../constants/supabase";
import { syncPatrolHourRecords } from "../sync/supabase";

const patrolLogo = require("../../assets/patrol-splash-logo.png");

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
  return patrolHourWindow(hourStart);
}

function currentWindowLabel(now: Date): string {
  return `${patrolDateKey(now)} ${patrolHourWindow(patrolHourStart(now))}`;
}

export const PatrolScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { session, endSession } = useSession();
  const { language } = useLanguage();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hourRecords, setHourRecords] = useState<PatrolHourRecord[]>([]);
  const scanLockRef = useRef(false);

  const checkpoints = PATROL_CONFIG.points;

  const goToShiftScreen = useCallback(() => {
    setScanning(false);
    setTorchOn(false);
    setIsProcessingScan(false);
    scanLockRef.current = false;
    navigation.replace("Shift");
  }, [navigation]);

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
      refreshRecords().catch(() => {});

      const onBackPress = () => {
        if (scanning) {
          setScanning(false);
          setTorchOn(false);
          setIsProcessingScan(false);
          scanLockRef.current = false;
          return true;
        }

        goToShiftScreen();
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => subscription.remove();
    }, [goToShiftScreen, refreshRecords, scanning]),
  );

  const now = new Date();
  const canPatrolNow = !!session;

  const todayRecords = useMemo(() => {
    if (!session) return [];
    const patrolDate = patrolDateKey();
    return hourRecords
      .filter((r) => r.dateKey === patrolDate && r.guardId === session.guardId)
      .sort((a, b) => a.hourStart - b.hourStart);
  }, [hourRecords, session]);

  const currentHourRecord = useMemo(() => {
    if (!session) return undefined;
    return todayRecords.find((r) => r.hourStart === patrolHourStart());
  }, [session, todayRecords]);

  const completedCount = currentHourRecord?.completedCount ?? 0;

  const displayHours = useMemo(() => {
    const hours = new Set<number>([patrolHourStart()]);
    todayRecords.forEach((record) => hours.add(record.hourStart));
    return Array.from(hours).sort((a, b) => a - b);
  }, [todayRecords]);

  const ensurePatrolAllowed = (): boolean => {
    if (!session) {
      Alert.alert(
        t(language, "noActiveShiftTitle"),
        t(language, "noActiveShiftMessage"),
      );
      return false;
    }

    return true;
  };

  const startScan = () => {
    if (!ensurePatrolAllowed()) return;

    if (hasPermission === false) {
      Alert.alert(
        t(language, "cameraBlockedTitle"),
        t(language, "cameraBlockedMessage"),
      );
      return;
    }

    setScanning(true);
    setIsProcessingScan(false);
    scanLockRef.current = false;
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
        t(language, "invalidQrTitle"),
        t(language, "invalidQrMessage"),
        [{ text: t(language, "ok"), onPress: finishScanAttempt }],
      );
      return;
    }

    const scanTime = new Date();
    const dateKey = patrolDateKey(scanTime);
    const hourStart = patrolHourStart(scanTime);
    const record = await upsertHourRecord({
      societyId: PATROL_CONFIG.societyId,
      society: PATROL_CONFIG.society,
      guardId: session.guardId,
      guardName: session.guardName,
      dateKey,
      hourStart,
      hourWindow: patrolHourWindow(hourStart),
    });

    if (record.scans[matched.point]) {
      Alert.alert(
        t(language, "alreadyScannedTitle"),
        t(language, "alreadyScannedMessage", { point: matched.label }),
        [{ text: t(language, "ok"), onPress: finishScanAttempt }],
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
    syncPatrolHourRecords(SUPABASE_SYNC_CONFIG)
      .then(refreshRecords)
      .catch(() => {});
    Vibration.vibrate(150);

    if (updated && updated.completedCount === checkpoints.length) {
      Alert.alert(
        t(language, "hourCompleteTitle"),
        t(language, "hourCompleteMessage", { count: checkpoints.length }),
        [{ text: t(language, "ok"), onPress: finishScanAttempt }],
      );
      return;
    }

    Alert.alert(
      t(language, "scanSavedTitle"),
      t(language, "scanSavedMessage", { point: matched.label }),
      [{ text: t(language, "ok"), onPress: finishScanAttempt }],
    );
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.centerContainer}>
          <Image
            source={patrolLogo}
            style={styles.emptyLogo}
            resizeMode="contain"
          />
          <Text style={styles.siteName}>{t(language, "societyName")}</Text>
          <Text style={styles.title}>{t(language, "patrolTitle")}</Text>
          <Text style={styles.infoText}>
            {t(language, "noActiveShiftMessage")}
          </Text>
          <View style={styles.centerButton}>
            <AppButton
              title={t(language, "startShift")}
              onPress={() => navigation.navigate("Shift")}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (scanning) {
    return (
      <SafeAreaView
        style={styles.scannerSafeArea}
        edges={["top", "left", "right"]}
      >
        <View style={styles.scannerContainer}>
          <Text style={styles.scannerTitle}>{t(language, "scanPrompt")}</Text>

          {hasPermission === false ? (
            <Text style={styles.infoText}>
              {t(language, "cameraPermissionMissing")}
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
                title={
                  torchOn ? t(language, "torchOff") : t(language, "torchOn")
                }
                onPress={() => setTorchOn((prev) => !prev)}
                variant="secondary"
              />
            </View>
            <View style={styles.actionColumn}>
              <AppButton
                title={t(language, "cancel")}
                onPress={finishScanAttempt}
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const recordForHour = (hourStart: number) => {
    return todayRecords.find((r) => r.hourStart === hourStart);
  };

  const statusLabel = (status?: string) => {
    if (!status) return t(language, "notStarted");
    if (status === "COMPLETED") return t(language, "completed");
    if (status === "MISSED") return t(language, "missed");
    return t(language, "inProgress");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={patrolLogo}
          style={styles.patrolLogo}
          resizeMode="contain"
        />
        <Text style={styles.siteName}>{t(language, "societyName")}</Text>
        <Text style={styles.title}>{t(language, "patrolTitle")}</Text>
        <View style={styles.shiftCard}>
          <Text style={styles.shiftTitle}>{session.guardName}</Text>
          <Text style={styles.shiftText}>
            {t(language, "guardId")}: {session.guardId}
          </Text>
          <Text style={styles.shiftText}>
            {t(language, "started")}: {formatDateTime(session.startedAt)}
          </Text>
        </View>

      <View style={styles.scanButtonWrap}>
        <AppButton
          title={t(language, "scanQr")}
          onPress={startScan}
          disabled={!canPatrolNow || hasPermission === null}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{t(language, "currentHour")}</Text>
        <Text style={styles.sectionMeta}>{currentWindowLabel(now)}</Text>
      </View>

      <View
        style={[
          styles.summaryCard,
          completedCount === checkpoints.length && styles.summaryCardCompleted,
        ]}
      >
        <Text style={styles.summaryText}>
          {t(language, "completed")}: {completedCount} / {checkpoints.length}
        </Text>
      </View>

      {checkpoints.map((point) => {
        const last = currentHourRecord?.scans[point.point]?.scannedAt;
        return (
          <View key={point.id} style={styles.checkpointCard}>
            <View style={styles.checkpointCopy}>
              <Text style={styles.checkpointName}>{point.label}</Text>
              <Text style={styles.checkpointInfo}>
                {t(language, "lastScan")}:{" "}
                {last ? formatDateTime(last) : t(language, "notScanned")}
              </Text>
            </View>
            <View style={[styles.scanPill, last && styles.scanPillDone]}>
              <Text
                style={[styles.scanPillText, last && styles.scanPillTextDone]}
              >
                {last ? "OK" : "--"}
              </Text>
            </View>
          </View>
        );
      })}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{t(language, "today")}</Text>
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
                {t(language, "points")}: {record?.completedCount ?? 0} /{" "}
                {checkpoints.length}
              </Text>
            </View>
          );
        })}
      </View>

        <AppButton
          title={t(language, "endShift")}
          onPress={endSession}
          variant="danger"
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f7f9fc",
  },
  scannerSafeArea: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
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
  emptyLogo: {
    width: 132,
    height: 132,
    marginBottom: 18,
  },
  container: {
    flex: 1,
    backgroundColor: "#f7f9fc",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  patrolLogo: {
    width: 104,
    height: 104,
    alignSelf: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#102a43",
    marginBottom: 12,
    textAlign: "center",
  },
  siteName: {
    marginBottom: 6,
    fontSize: 16,
    fontWeight: "700",
    color: "#486581",
    textAlign: "center",
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
