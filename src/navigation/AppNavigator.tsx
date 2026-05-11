// src/navigation/AppNavigator.tsx
// Stack navigator wiring together the three screens.

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CapturedMarker } from '../types/marker';
import CameraScreen from '../screens/CameraScreen';
import ResultsScreen from '../screens/ResultsScreen';
import MarkerDetailScreen from '../screens/MarkerDetailScreen';

// ─── Route param types ────────────────────────────────────────────────────────

export type RootStackParamList = {
  Camera: undefined;
  Results: { markers: CapturedMarker[] };
  MarkerDetail: { marker: CapturedMarker };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── Navigator ────────────────────────────────────────────────────────────────

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Camera"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#000' },
        }}
      >
        <Stack.Screen name="Camera" component={CameraScreen} />
        <Stack.Screen name="Results" component={ResultsScreen} />
        <Stack.Screen name="MarkerDetail" component={MarkerDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
