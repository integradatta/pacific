import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushToQueue, backoffDelayMs, QUEUE_MAX } from '@pacific/geo-shared';
import { apiSend } from './api';

// Fila local de pontos não enviados (offline → sincroniza ao reconectar). Spec §1.8.
const KEY = 'geo_point_queue';
const DEVICE_KEY = 'geo_device_id';

export interface QueuedPoint {
  device_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  altitude_meters?: number;
  speed_mps?: number;
  heading_degrees?: number;
  battery_level?: number;
  source: 'gps' | 'network' | 'fused';
  timestamp: string;
}

async function read(): Promise<QueuedPoint[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as QueuedPoint[]) : [];
}
async function write(q: QueuedPoint[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(q));
}

export async function enqueue(point: QueuedPoint): Promise<void> {
  const q = await read();
  await write(pushToQueue(q, point, QUEUE_MAX));
}

export async function deviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    await AsyncStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/**
 * Tenta enviar a fila em lote (máx 50/req). Em falha, aplica backoff exponencial e mantém
 * os pontos para a próxima tentativa. Limpa a fila só quando o batch é aceito.
 */
export async function flush(maxAttempts = 5): Promise<{ sent: number }> {
  let q = await read();
  if (q.length === 0) return { sent: 0 };
  let sent = 0;
  for (let attempt = 0; attempt < maxAttempts && q.length > 0; attempt++) {
    const batch = q.slice(0, 50);
    try {
      await apiSend('POST', '/api/v1/locations/batch', { device_id: batch[0].device_id, points: batch });
      q = q.slice(batch.length);
      await write(q);
      sent += batch.length;
    } catch {
      await new Promise((r) => setTimeout(r, backoffDelayMs(attempt)));
    }
  }
  return { sent };
}
