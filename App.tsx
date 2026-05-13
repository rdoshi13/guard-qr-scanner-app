import React, { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";

import { RootNavigator } from "./src/navigation/RootNavigator";
import { LanguageProvider } from "./src/context/LanguageContext";
import { SessionProvider } from "./src/context/SessionContext";
import { runAutoSyncIfDue } from "./src/sync/autoSync";

const AUTO_SYNC_POLL_MS = 60 * 1000;

const AppBootstrap: React.FC = () => {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const triggerAutoSync = () =>
      runAutoSyncIfDue().catch(() => {
        // Sync is best-effort and should never block patrol scans.
      });

    triggerAutoSync();

    const intervalId = setInterval(() => {
      if (appStateRef.current === "active") {
        triggerAutoSync();
      }
    }, AUTO_SYNC_POLL_MS);

    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasBackground =
        appStateRef.current === "inactive" ||
        appStateRef.current === "background";
      appStateRef.current = nextState;

      if (wasBackground && nextState === "active") {
        triggerAutoSync();
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, []);

  return null;
};

export default function App() {
  return (
    <LanguageProvider>
      <SessionProvider>
        <AppBootstrap />
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="dark" />
      </SessionProvider>
    </LanguageProvider>
  );
}
