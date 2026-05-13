import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { PatrolScreen } from "../screens/PatrolScreen";
import { ShiftScreen } from "../screens/ShiftScreen";
import { useLanguage } from "../context/LanguageContext";
import { t } from "../i18n/strings";

export type RootStackParamList = {
  Shift: undefined;
  Patrol: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { language } = useLanguage();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Shift"
        component={ShiftScreen}
        options={{
          title: t(language, "shiftScreenTitle"),
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="Patrol"
        component={PatrolScreen}
        options={{
          title: t(language, "patrolTitle"),
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
};
