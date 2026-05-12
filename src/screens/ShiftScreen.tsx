import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppButton } from "../components/AppButton";
import { useSession } from "../context/SessionContext";
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

  const startNightShift = () => {
    if (!canStart) {
      Alert.alert("Missing details", "Enter a guard name and guard ID.");
      return;
    }

    startSession({
      guardId: guardId.trim(),
      guardName: guardName.trim(),
      shift: "NIGHT",
      startedAt: new Date().toISOString(),
    });
    navigation.replace("Patrol");
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Rosedale QR Patrol</Text>
        <Text style={styles.subtitle}>
          Start a NIGHT shift to scan patrol checkpoints.
        </Text>

        {session ? (
          <View style={styles.sessionCard}>
            <Text style={styles.cardTitle}>Active shift</Text>
            <Text style={styles.cardText}>{session.guardName}</Text>
            <Text style={styles.cardMeta}>Guard ID: {session.guardId}</Text>
            <Text style={styles.cardMeta}>
              Started: {formatDateTime(session.startedAt)}
            </Text>
            <View style={styles.buttonGap}>
              <AppButton
                title="Continue scanning"
                onPress={() => navigation.navigate("Patrol")}
              />
            </View>
            <AppButton title="End shift" onPress={endSession} variant="danger" />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Guard name</Text>
            <TextInput
              value={guardName}
              onChangeText={setGuardName}
              placeholder="Enter guard name"
              autoCapitalize="words"
              style={styles.input}
            />

            <Text style={styles.label}>Guard ID</Text>
            <TextInput
              value={guardId}
              onChangeText={(value) => {
                setGuardIdEdited(true);
                setGuardId(value);
              }}
              placeholder="Enter guard ID"
              autoCapitalize="characters"
              style={styles.input}
            />

            <AppButton
              title="Start NIGHT shift"
              onPress={startNightShift}
              disabled={!canStart}
              style={styles.startButton}
            />
          </View>
        )}

        {lastSession && !session ? (
          <View style={styles.lastCard}>
            <Text style={styles.cardTitle}>Last shift</Text>
            <Text style={styles.cardText}>{lastSession.guardName}</Text>
            <Text style={styles.cardMeta}>
              Ended: {formatDateTime(lastSession.endedAt)}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
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
});
