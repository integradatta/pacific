import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { startTracking } from '../lib/location';

type Props = NativeStackScreenProps<RootStackParamList, 'Consent'>;

// Onboarding de CONSENTIMENTO (spec §1.2): explica, pede permissão do SO e só então compartilha.
// Voluntário e revogável — nada é enviado sem este passo.
export function ConsentScreen({ navigation, route }: Props) {
  const groupId = route.params?.groupId ?? 'demo-group';
  const [busy, setBusy] = useState(false);

  async function onAccept() {
    setBusy(true);
    try {
      const r = await startTracking();
      if (!r.ok) {
        Alert.alert('Permissão necessária', 'Para compartilhar, autorize a localização nas configurações do sistema.');
        return;
      }
      navigation.replace('Map', { groupId });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Compartilhar sua localização</Text>
      <Text style={styles.lead}>Você decide. O compartilhamento é voluntário e pode ser pausado ou encerrado a qualquer momento.</Text>

      <View style={styles.bullets}>
        <Text style={styles.bullet}>• Sua localização é enviada ao grupo só enquanto você permitir.</Text>
        <Text style={styles.bullet}>• Você verá as permissões concedidas e poderá revogá-las nas Configurações.</Text>
        <Text style={styles.bullet}>• Em segundo plano, o app mostra um aviso de que está compartilhando.</Text>
        <Text style={styles.bullet}>• Nada é coletado sem o seu consentimento explícito.</Text>
      </View>

      <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={onAccept} disabled={busy}>
        <Text style={styles.btnText}>{busy ? 'Solicitando…' : 'Permitir e compartilhar'}</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('Settings', { groupId })}>
        <Text style={styles.link}>Configurações</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E17', padding: 24, justifyContent: 'center' },
  title: { color: '#E8ECF4', fontSize: 24, fontWeight: '600' },
  lead: { color: '#9AA4B8', fontSize: 15, marginTop: 8 },
  bullets: { marginTop: 24, marginBottom: 24 },
  bullet: { color: '#9AA4B8', fontSize: 14, marginBottom: 10, lineHeight: 20 },
  btn: { backgroundColor: '#2BE5C2', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#0A0E17', fontWeight: '700', fontSize: 15 },
  link: { color: '#2BE5C2', textAlign: 'center', marginTop: 16 },
});
