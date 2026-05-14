import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton } from "../components/AppButton";
import { useLanguage } from "../context/LanguageContext";
import { useSession } from "../context/SessionContext";
import { Language, t } from "../i18n/strings";
import { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Shift">;

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

function makeGuardId(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

export const ShiftScreen: React.FC<Props> = ({ navigation }) => {
  const { session, lastSession, startSession, endSession } = useSession();
  const { language, setLanguage } = useLanguage();
  const [guardName, setGuardName] = useState(lastSession?.guardName ?? "");
  const [guardId, setGuardId] = useState(lastSession?.guardId ?? "");
  const [guardIdEdited, setGuardIdEdited] = useState(false);

  const canStart = useMemo(
    () => guardName.trim().length > 0 && guardId.trim().length > 0,
    [guardId, guardName],
  );

  useEffect(() => {
    if (guardIdEdited) return;
    setGuardId(makeGuardId(guardName));
  }, [guardIdEdited, guardName]);

  useFocusEffect(
    React.useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          BackHandler.exitApp();
          return true;
        },
      );
      return () => subscription.remove();
    }, []),
  );

  const startShift = () => {
    if (!canStart) {
      Alert.alert(
        t(language, "missingDetailsTitle"),
        t(language, "missingDetailsMessage"),
      );
      return;
    }

    startSession({
      guardId: guardId.trim(),
      guardName: guardName.trim(),
      startedAt: new Date().toISOString(),
    });
    navigation.replace("Patrol");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{t(language, "startShiftTitle")}</Text>
          <Text style={styles.subtitle}>
            {t(language, "startShiftSubtitle")}
          </Text>

        {session ? (
          <View style={styles.sessionCard}>
            <Text style={styles.cardTitle}>{t(language, "activeShift")}</Text>
            <Text style={styles.cardText}>{session.guardName}</Text>
            <Text style={styles.cardMeta}>
              {t(language, "guardId")}: {session.guardId}
            </Text>
            <Text style={styles.cardMeta}>
              {t(language, "started")}: {formatDateTime(session.startedAt)}
            </Text>
            <View style={styles.buttonGap}>
              <AppButton
                title={t(language, "continueScanning")}
                onPress={() => navigation.replace("Patrol")}
              />
            </View>
            <AppButton
              title={t(language, "endShift")}
              onPress={endSession}
              variant="danger"
            />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>{t(language, "guardName")}</Text>
            <TextInput
              value={guardName}
              onChangeText={setGuardName}
              placeholder={t(language, "enterGuardName")}
              autoCapitalize="words"
              style={styles.input}
            />

            <Text style={styles.label}>{t(language, "guardId")}</Text>
            <TextInput
              value={guardId}
              onChangeText={(value) => {
                setGuardIdEdited(true);
                setGuardId(value);
              }}
              placeholder={t(language, "enterGuardId")}
              autoCapitalize="characters"
              style={styles.input}
            />

            <AppButton
              title={t(language, "startShift")}
              onPress={startShift}
              disabled={!canStart}
              style={styles.startButton}
            />
          </View>
        )}

        {lastSession && !session ? (
          <View style={styles.lastCard}>
            <Text style={styles.cardTitle}>{t(language, "lastShift")}</Text>
            <Text style={styles.cardText}>{lastSession.guardName}</Text>
            <Text style={styles.cardMeta}>
              {t(language, "ended")}: {formatDateTime(lastSession.endedAt)}
            </Text>
          </View>
        ) : null}

        <View style={styles.languageSection}>
          <Text style={styles.languageTitle}>{t(language, "language")}</Text>
          <View style={styles.languageRow}>
            {(["en", "gu"] as Language[]).map((item) => {
              const selected = language === item;
              return (
                <View key={item} style={styles.languageButtonWrap}>
                  <AppButton
                    title={t(language, item === "en" ? "english" : "gujarati")}
                    onPress={() => setLanguage(item)}
                    variant={selected ? "primary" : "secondary"}
                  />
                </View>
              );
            })}
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f7f9fc",
  },
  keyboard: {
    flex: 1,
    backgroundColor: "#f7f9fc",
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#102a43",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#52606d",
  },
  form: {
    marginTop: 24,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "700",
    color: "#334e68",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    marginBottom: 16,
    fontSize: 16,
    color: "#102a43",
  },
  startButton: {
    marginTop: 8,
  },
  sessionCard: {
    marginTop: 24,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  lastCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9e2ec",
    backgroundColor: "#ffffff",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#334e68",
  },
  cardText: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#102a43",
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 14,
    color: "#52606d",
  },
  buttonGap: {
    marginTop: 14,
    marginBottom: 10,
  },
  languageSection: {
    marginTop: 16,
  },
  languageTitle: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "800",
    color: "#334e68",
  },
  languageRow: {
    flexDirection: "row",
    gap: 10,
  },
  languageButtonWrap: {
    flex: 1,
  },
});
