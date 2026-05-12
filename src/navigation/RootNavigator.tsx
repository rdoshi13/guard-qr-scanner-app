import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { PatrolScreen } from "../screens/PatrolScreen";
import { ShiftScreen } from "../screens/ShiftScreen";

export type RootStackParamList = {
  Shift: undefined;
  Patrol: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Shift"
        component={ShiftScreen}
        options={{ title: "Start Shift" }}
      />
      <Stack.Screen
        name="Patrol"
        component={PatrolScreen}
        options={{ title: "QR Patrol" }}
      />
    </Stack.Navigator>
  );
};
