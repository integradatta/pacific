import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { MapScreen } from './src/screens/MapScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

export type RootStackParamList = {
  Consent: { groupId: string } | undefined;
  Map: { groupId: string };
  Settings: { groupId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Consent" screenOptions={{ headerStyle: { backgroundColor: '#0A0E17' }, headerTintColor: '#E8ECF4' }}>
        <Stack.Screen name="Consent" component={ConsentScreen} options={{ title: 'Compartilhar localização' }} />
        <Stack.Screen name="Map" component={MapScreen} options={{ title: 'Mapa do grupo' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configurações' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
