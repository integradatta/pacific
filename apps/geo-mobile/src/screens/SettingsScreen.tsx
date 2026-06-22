import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { apiSend } from '../lib/api';
import { stopTracking, isTracking } from '../lib/location';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

// Controle do próprio compartilhamento (spec §1.2): pausar/retomar/encerrar + ver permissões.
export function SettingsScreen({ route }: Props) {
  const { groupId } = route.params;
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    isTracking().then(setTracking);
  }, []);

  async function setStatus(action: 'pause' | 'resume' | 'revoke') {
    try {
      await apiSend('PUT', `/api/v1/groups/${groupId}/sharing-status`, { action });
      if (action === 'revoke') {
        await stopTracking();
        setTracking(false);
      }
      Alert.alert('Pronto', `Compartilhamento: ${action}.`);
    } catch (e) {
      Alert.alert('Erro', String(e));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.section}>COMPARTILHAMENTO</Text>
      <Text style={styles.status}>Rastreamento em segundo plano: {tracking ? 'ativo' : 'inativo'}</Text>

      <Pressable style={styles.btn} onPress={() => setStatus('pause')}>
        <Text style={styles.btnText}>Pausar compartilhamento</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={() => setStatus('resume')}>
        <Text style={styles.btnText}>Retomar compartilhamento</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.danger]} onPress={() => setStatus('revoke')}>
        <Text style={[styles.btnText, styles.dangerText]}>Encerrar (sair do compartilhamento)</Text>
      </Pressable>

      <Text style={styles.section}>PERMISSÕES</Text>
      <Pressable style={styles.btn} onPress={() => Linking.openSettings()}>
        <Text style={styles.btnText}>Ver permissões do app (Configurações do sistema)</Text>
      </Pressable>

      <Text style={styles.note}>Você pode interromper o compartilhamento a qualquer momento. Ao encerrar, paramos de enviar sua localização imediatamente.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E17', padding: 20 },
  section: { color: '#64708A', fontSize: 11, letterSpacing: 1.5, marginTop: 20, marginBottom: 8 },
  status: { color: '#9AA4B8', marginBottom: 12 },
  btn: { backgroundColor: '#141A28', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1F2837' },
  btnText: { color: '#E8ECF4', fontSize: 14 },
  danger: { borderColor: 'rgba(240,85,106,0.4)' },
  dangerText: { color: '#F0556A' },
  note: { color: '#64708A', fontSize: 12, marginTop: 20, lineHeight: 18 },
});
