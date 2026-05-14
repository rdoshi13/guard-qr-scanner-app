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
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="Shift"
        component={ShiftScreen}
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="Patrol"
        component={PatrolScreen}
        options={{
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
};
